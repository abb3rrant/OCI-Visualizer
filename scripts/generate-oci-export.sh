#!/bin/bash
# OCI Environment Export Script
# Generates JSON exports of all OCI resources for import into OCI Visualizer
#
# Prerequisites:
#   - OCI CLI installed and configured (oci setup config)
#   - jq installed (for merging multi-compartment results)
#   - Appropriate IAM permissions to list resources
#
# Usage:
#   ./generate-oci-export.sh -c COMPARTMENT_ID [-r REGION] [-o OUTPUT_DIR]
#   ./generate-oci-export.sh -f FILE [-r REGION] [-o OUTPUT_DIR]
#
#   -c  Single compartment OCID
#   -f  File with one compartment OCID per line (for multi-compartment export)
#   -r  Region (defaults to CLI default region)
#   -o  Output directory (defaults to ./oci-export-TIMESTAMP)

# No strict mode — the script handles errors explicitly with || true guards.
# set -euo pipefail caused premature exits with multi-compartment exports.

# Defaults
COMPARTMENT_ID=""
COMPARTMENT_FILE=""
REGION=""
OUTPUT_DIR="./oci-export-$(date +%Y%m%d-%H%M%S)"
MAX_PARALLEL=${MAX_PARALLEL:-8}

while getopts "c:f:r:o:h" opt; do
  case $opt in
    c) COMPARTMENT_ID="$OPTARG" ;;
    f) COMPARTMENT_FILE="$OPTARG" ;;
    r) REGION="$OPTARG" ;;
    o) OUTPUT_DIR="$OPTARG" ;;
    h)
      echo "Usage: $0 [-c COMPARTMENT_ID] [-f COMPARTMENT_FILE] [-r REGION] [-o OUTPUT_DIR]"
      echo "  -c  Single compartment OCID (defaults to tenancy root)"
      echo "  -f  File with one compartment OCID per line (multi-compartment)"
      echo "  -r  Region (defaults to CLI default region)"
      echo "  -o  Output directory (defaults to ./oci-export-TIMESTAMP)"
      exit 0
      ;;
    *) echo "Invalid option: -$OPTARG" >&2; exit 1 ;;
  esac
done
shift $((OPTIND - 1))

# If a positional argument remains and no -f/-c was given, treat it as a compartment file
if [ $# -gt 0 ] && [ -z "$COMPARTMENT_FILE" ] && [ -z "$COMPARTMENT_ID" ]; then
  if [ -f "$1" ]; then
    COMPARTMENT_FILE="$1"
    echo "Using positional argument as compartment file: $1"
  else
    # Might be a bare compartment OCID
    COMPARTMENT_ID="$1"
    echo "Using positional argument as compartment OCID: $1"
  fi
elif [ $# -gt 0 ]; then
  echo "WARNING: Ignoring extra arguments: $*"
  echo "         (already have -c or -f flag)"
fi

# Build compartment list
COMPARTMENT_IDS=()

if [ -n "$COMPARTMENT_FILE" ]; then
  if [ ! -f "$COMPARTMENT_FILE" ]; then
    echo "ERROR: Compartment file not found: $COMPARTMENT_FILE"
    exit 1
  fi
  # Read file, handling newline, comma, space, or tab-separated OCIDs.
  # Also strips BOM, \r, and trims whitespace.
  file_content=$(cat "$COMPARTMENT_FILE" | tr -d '\xEF\xBB\xBF' | tr -d '\r' | tr ',' '\n' | tr '\t' '\n')
  while IFS= read -r line; do
    line=$(echo "$line" | xargs 2>/dev/null || echo "$line")   # trim whitespace
    [ -z "$line" ] && continue
    [[ "$line" == \#* ]] && continue  # skip comments
    COMPARTMENT_IDS+=("$line")
  done <<< "$file_content"
  if [ ${#COMPARTMENT_IDS[@]} -eq 0 ]; then
    echo "ERROR: No compartment OCIDs found in $COMPARTMENT_FILE"
    exit 1
  fi
  echo "Loaded ${#COMPARTMENT_IDS[@]} compartment(s) from $COMPARTMENT_FILE"
elif [ -n "$COMPARTMENT_ID" ]; then
  COMPARTMENT_IDS=("$COMPARTMENT_ID")
else
  # Try to get tenancy root
  COMPARTMENT_ID=$(oci iam compartment list --query 'data[0]."compartment-id"' --raw-output 2>/dev/null || true)
  if [ -z "$COMPARTMENT_ID" ]; then
    echo "ERROR: Could not determine tenancy OCID. Specify with -c flag or -f file."
    exit 1
  fi
  echo "Using tenancy root: $COMPARTMENT_ID"
  COMPARTMENT_IDS=("$COMPARTMENT_ID")
fi

REGION_FLAG=""
if [ -n "$REGION" ]; then
  REGION_FLAG="--region $REGION"
fi

mkdir -p "$OUTPUT_DIR"

# ---------------------------------------------------------------
# Error logging
# ---------------------------------------------------------------
ERROR_LOG="$OUTPUT_DIR/_errors.log"
: > "$ERROR_LOG"

# ---------------------------------------------------------------
# Progress counter
# ---------------------------------------------------------------
EXPORT_COUNT=0

# ---------------------------------------------------------------
# Semaphore for parallel execution
# ---------------------------------------------------------------
_SEM_FIFO=""

_sem_init() {
  _SEM_FIFO=$(mktemp -u)
  mkfifo "$_SEM_FIFO"
  exec 7<>"$_SEM_FIFO"
  rm -f "$_SEM_FIFO"
  local i
  for ((i = 0; i < MAX_PARALLEL; i++)); do
    echo >&7
  done
}

_sem_acquire() {
  read -u 7
}

_sem_release() {
  echo >&7
}

_sem_init

# Cleanup on exit: close FD 7, kill background jobs
trap 'exec 7>&-; wait 2>/dev/null; exit' EXIT INT TERM

# ---------------------------------------------------------------
# wait_all: barrier — wait for all background jobs to finish
# ---------------------------------------------------------------
wait_all() {
  wait
}

echo "=== OCI Resource Export ==="
if [ ${#COMPARTMENT_IDS[@]} -eq 1 ]; then
  echo "Mode: SINGLE compartment"
  echo "  ${COMPARTMENT_IDS[0]}"
else
  echo "Mode: MULTI compartment (${#COMPARTMENT_IDS[@]} compartments)"
  for cid in "${COMPARTMENT_IDS[@]}"; do
    echo "  - $cid"
  done
fi
echo "Output: $OUTPUT_DIR"
echo "Parallelism: $MAX_PARALLEL"
echo ""

# ---------------------------------------------------------------
# merge_parts: combine per-chunk JSON array files into one output
# Each part file contains a JSON array. Result: {"data": [...merged...]}
# Streams through files on disk instead of accumulating in memory.
# ---------------------------------------------------------------
merge_parts() {
  local td="$1" outfile="$2"
  local parts=("$td"/part_*.json)
  if [ ! -e "${parts[0]}" ]; then return 1; fi
  # Merge all arrays and wrap in envelope
  if ! jq -s 'add' "$td"/part_*.json 2>/dev/null | jq '{data:.}' > "$outfile" 2>/dev/null; then
    rm -f "$outfile"
    return 1
  fi
  # Verify output has data (jq on empty files exits 0 with no output, so check -s first)
  if [ -s "$outfile" ] && jq -e '.data and (.data|length) > 0' "$outfile" >/dev/null 2>&1; then
    local cnt
    cnt=$(jq '.data | length' "$outfile" 2>/dev/null || echo "?")
    echo " OK (${cnt:-0} items)"
    return 0
  else
    rm -f "$outfile"
    return 1
  fi
}

# ---------------------------------------------------------------
# run_export: export a resource type across all compartments
# Each compartment result streams to a temp file on disk.
# ---------------------------------------------------------------
run_export() {
  local name="$1"
  local cmd="$2"
  local _count="${3:-}"  # optional pre-assigned count from run_export_bg
  local outfile="$OUTPUT_DIR/${name}.json"

  if [ -n "$_count" ]; then
    echo -n "  [$_count] Exporting ${name}..."
  else
    EXPORT_COUNT=$((EXPORT_COUNT + 1))
    echo -n "  [$EXPORT_COUNT] Exporting ${name}..."
  fi

  if [ ${#COMPARTMENT_IDS[@]} -eq 1 ]; then
    # Single compartment — capture to temp, validate with jq, then move
    local tmpraw
    tmpraw=$(mktemp)
    if eval "$cmd --compartment-id ${COMPARTMENT_IDS[0]} --all $REGION_FLAG" > "$tmpraw" 2>>"$ERROR_LOG"; then
      if jq '.' "$tmpraw" > "$outfile" 2>/dev/null; then
        local count
        count=$(jq '.data | length' "$outfile" 2>/dev/null || echo "?")
        echo " OK ($count items)"
      else
        echo " FAILED (invalid JSON, skipping)"
        echo "[$(date +%H:%M:%S)] $name: invalid JSON response" >> "$ERROR_LOG"
        rm -f "$outfile"
      fi
    else
      echo " FAILED (skipping)"
      echo "[$(date +%H:%M:%S)] $name: OCI CLI command failed" >> "$ERROR_LOG"
      rm -f "$outfile"
    fi
    rm -f "$tmpraw"
  else
    # Multi-compartment — stream each result to a temp file
    local td
    td=$(mktemp -d)
    local i=0
    local total=${#COMPARTMENT_IDS[@]}
    local hits=0
    for cid in "${COMPARTMENT_IDS[@]}"; do
      i=$((i + 1))
      # Run OCI CLI and capture result; don't let failures stop the loop
      local tmpout="$td/part_${i}.json"
      eval "$cmd --compartment-id $cid --all $REGION_FLAG" > "$td/_raw_${i}.json" 2>>"$ERROR_LOG" || true
      # Extract .data array (default to empty array)
      jq '.data // []' "$td/_raw_${i}.json" > "$tmpout" 2>/dev/null || echo '[]' > "$tmpout"
      rm -f "$td/_raw_${i}.json"
      # Remove empty arrays to save disk
      if jq -e 'length > 0' "$tmpout" >/dev/null 2>&1; then
        hits=$((hits + 1))
      else
        rm -f "$tmpout"
      fi
    done
    echo -n " ($hits/$total compartments had data)"
    merge_parts "$td" "$outfile" || echo " EMPTY (skipping)"
    rm -rf "$td"
  fi
}

# ---------------------------------------------------------------
# run_export_bg: run run_export in the background with semaphore
# ---------------------------------------------------------------
run_export_bg() {
  # Increment counter in parent shell so it propagates
  EXPORT_COUNT=$((EXPORT_COUNT + 1))
  local _bg_count=$EXPORT_COUNT
  _sem_acquire
  (
    run_export "$@" "$_bg_count"
    _sem_release
  ) &
}

# ---------------------------------------------------------------
# run_export_per_ad: export resources that need --availability-domain
# ---------------------------------------------------------------
run_export_per_ad() {
  local name="$1"
  local cmd="$2"
  local outfile="$OUTPUT_DIR/${name}.json"

  EXPORT_COUNT=$((EXPORT_COUNT + 1))
  echo -n "  [$EXPORT_COUNT] Exporting ${name} (per-AD)..."

  local td
  td=$(mktemp -d)
  local i=0

  for cid in "${COMPARTMENT_IDS[@]}"; do
    local ads
    ads=$(oci iam availability-domain list --compartment-id "$cid" $REGION_FLAG 2>/dev/null | jq -r '.data[]?.name // empty' 2>/dev/null || true)
    [ -z "$ads" ] && continue

    while IFS= read -r ad; do
      [ -z "$ad" ] && continue
      eval "$cmd --compartment-id $cid --availability-domain \"$ad\" --all $REGION_FLAG" 2>>"$ERROR_LOG" \
        | jq '.data // []' > "$td/part_$i.json" 2>/dev/null || true
      jq -e 'length > 0' "$td/part_$i.json" >/dev/null 2>&1 || rm -f "$td/part_$i.json"
      i=$((i + 1))
    done <<< "$ads"
  done

  merge_parts "$td" "$outfile" || echo " EMPTY (skipping)"
  rm -rf "$td"
}

# ---------------------------------------------------------------
# run_export_per_parent: export resources that need a parent ID
# e.g., functions need --application-id, node-pools need --cluster-id
# ---------------------------------------------------------------
run_export_per_parent() {
  local name="$1"
  local child_cmd="$2"
  local parent_file="$3"     # file we already exported that contains parent resources
  local parent_id_field="$4" # jq field to extract parent ID from (e.g., ".id")
  local outfile="$OUTPUT_DIR/${name}.json"

  EXPORT_COUNT=$((EXPORT_COUNT + 1))
  echo -n "  [$EXPORT_COUNT] Exporting ${name} (per-parent)..."

  local parent_path="$OUTPUT_DIR/${parent_file}.json"
  if [ ! -f "$parent_path" ]; then
    echo " SKIPPED (no ${parent_file}.json)"
    return
  fi

  local parent_ids
  parent_ids=$(jq -r ".data[]?${parent_id_field} // empty" "$parent_path" 2>/dev/null || true)
  if [ -z "$parent_ids" ]; then
    echo " EMPTY (no parents found)"
    return
  fi

  local td
  td=$(mktemp -d)
  local i=0

  while IFS= read -r pid; do
    [ -z "$pid" ] && continue
    eval "$child_cmd $pid --all $REGION_FLAG" 2>>"$ERROR_LOG" \
      | jq '.data // []' > "$td/part_$i.json" 2>/dev/null || true
    jq -e 'length > 0' "$td/part_$i.json" >/dev/null 2>&1 || rm -f "$td/part_$i.json"
    i=$((i + 1))
  done <<< "$parent_ids"

  merge_parts "$td" "$outfile" || echo " EMPTY (skipping)"
  rm -rf "$td"
}

# ---------------------------------------------------------------
# run_export_per_bucket: export resources per Object Storage bucket
# Reads buckets.json, extracts bucket name and namespace fields,
# iterates each bucket with --bucket-name and -ns flags.
# ---------------------------------------------------------------
run_export_per_bucket() {
  local name="$1"
  local cmd="$2"
  local outfile="$OUTPUT_DIR/${name}.json"

  EXPORT_COUNT=$((EXPORT_COUNT + 1))
  echo -n "  [$EXPORT_COUNT] Exporting ${name} (per-bucket)..."

  local bucket_path="$OUTPUT_DIR/buckets.json"
  if [ ! -f "$bucket_path" ]; then
    echo " SKIPPED (no buckets.json)"
    return
  fi

  local bucket_info
  bucket_info=$(jq -r '.data[]? | "\(.namespace // empty)\t\(.name // empty)"' "$bucket_path" 2>/dev/null || true)
  if [ -z "$bucket_info" ]; then
    echo " EMPTY (no buckets found)"
    return
  fi

  local td
  td=$(mktemp -d)
  local i=0

  while IFS=$'\t' read -r ns bname; do
    [ -z "$ns" ] && continue
    [ -z "$bname" ] && continue
    eval "$cmd --bucket-name \"$bname\" -ns \"$ns\" $REGION_FLAG" 2>>"$ERROR_LOG" \
      | jq '.data // []' > "$td/part_$i.json" 2>/dev/null || true
    # Normalize: if result is an object (not array), wrap in array
    if jq -e 'type == "object"' "$td/part_$i.json" >/dev/null 2>&1; then
      jq '[.]' "$td/part_$i.json" > "$td/part_${i}_tmp.json" 2>/dev/null && mv "$td/part_${i}_tmp.json" "$td/part_$i.json"
    fi
    jq -e 'length > 0' "$td/part_$i.json" >/dev/null 2>&1 || rm -f "$td/part_$i.json"
    i=$((i + 1))
  done <<< "$bucket_info"

  merge_parts "$td" "$outfile" || echo " EMPTY (skipping)"
  rm -rf "$td"
}

# ===================================================================
# IAM
# ===================================================================
echo "=== IAM ==="
run_export "compartments" "oci iam compartment list --compartment-id-in-subtree true"
run_export "users" "oci iam user list"
run_export "groups" "oci iam group list"
run_export_bg "policies" "oci iam policy list"
run_export_bg "dynamic-groups" "oci iam dynamic-group list"
wait_all
run_export_per_parent "api-keys" "oci iam user api-key list --user-id" "users" '.id'
run_export_per_parent "customer-secret-keys" "oci iam customer-secret-key list --user-id" "users" '.id'
# Group memberships: iterate each group with list-users, synthesize membership records
EXPORT_COUNT=$((EXPORT_COUNT + 1))
echo -n "  [$EXPORT_COUNT] Exporting user-group-memberships (per-group)..."
_grp_file="$OUTPUT_DIR/groups.json"
if [ -f "$_grp_file" ]; then
  _grp_ids=$(jq -r '.data[]?.id // empty' "$_grp_file" 2>/dev/null || true)
  if [ -n "$_grp_ids" ]; then
    _td=$(mktemp -d)
    _p=0
    _mc=0
    while IFS= read -r _gid; do
      [ -z "$_gid" ] && continue
      _raw=$(oci iam group list-users --group-id "$_gid" --all $REGION_FLAG 2>>"$ERROR_LOG" || true)
      if [ -n "$_raw" ]; then
        _ms=$(echo "$_raw" | jq --arg gid "$_gid" '[.data[]? | {"id":("membership:"+$gid+":"+.id),"user-id":.id,"group-id":$gid,"compartment-id":."compartment-id","lifecycle-state":"ACTIVE","time-created":."time-created"}]' 2>/dev/null || echo '[]')
        _c=$(echo "$_ms" | jq 'length' 2>/dev/null || echo 0)
        if [ "$_c" -gt 0 ]; then
          echo "$_ms" > "$_td/part_${_p}.json"
          _mc=$((_mc + _c))
          _p=$((_p + 1))
        fi
      fi
    done <<< "$_grp_ids"
    echo -n " ($_mc memberships)"
    merge_parts "$_td" "$OUTPUT_DIR/user-group-memberships.json" || echo " EMPTY (skipping)"
    rm -rf "$_td"
  else
    echo " EMPTY (no groups)"
  fi
else
  echo " SKIPPED (no groups.json)"
fi
run_export "tag-namespaces" "oci iam tag-namespace list"
run_export "tag-defaults" "oci iam tag-default list"
run_export_per_parent "tags" "oci iam tag list --tag-namespace-id" "tag-namespaces" '.id'
run_export_per_parent "auth-tokens" "oci iam auth-token list --user-id" "users" '.id'
run_export_per_parent "smtp-credentials" "oci iam smtp-credential list --user-id" "users" '.id'
run_export_bg "network-sources" "oci iam network-sources list"
run_export_bg "region-subscriptions" "oci iam region-subscription list"
wait_all

# ===================================================================
# Compute
# ===================================================================
echo ""
echo "=== Compute ==="
run_export "instances" "oci compute instance list"
run_export_bg "images" "oci compute image list"
run_export "vnic-attachments" "oci compute vnic-attachment list"
run_export_per_ad "boot-volume-attachments" "oci compute boot-volume-attachment list"
run_export_bg "instance-configurations" "oci compute-management instance-configuration list"
run_export_bg "instance-pools" "oci compute-management instance-pool list"
run_export_bg "volume-attachments" "oci compute volume-attachment list"
run_export_bg "dedicated-vm-hosts" "oci compute dedicated-vm-host list"
run_export_bg "capacity-reservations" "oci compute compute-capacity-reservation list"
run_export_bg "compute-clusters" "oci compute compute-cluster list"
run_export_bg "console-histories" "oci compute console-history list"
run_export_bg "autoscaling-configs" "oci autoscaling configuration list"
wait_all

# ===================================================================
# Networking
# ===================================================================
echo ""
echo "=== Networking ==="
run_export "vcns" "oci network vcn list"
run_export "subnets" "oci network subnet list"
run_export_bg "security-lists" "oci network security-list list"
run_export_bg "route-tables" "oci network route-table list"
run_export "nsgs" "oci network nsg list"
run_export_bg "internet-gateways" "oci network internet-gateway list"
run_export_bg "nat-gateways" "oci network nat-gateway list"
run_export_bg "service-gateways" "oci network service-gateway list"
run_export "drgs" "oci network drg list"
run_export_bg "drg-attachments" "oci network drg-attachment list"
run_export_bg "local-peering-gateways" "oci network local-peering-gateway list"
run_export_bg "dhcp-options" "oci network dhcp-options list"
run_export_bg "vlans" "oci network vlan list"
run_export_bg "cpes" "oci network cpe list"
run_export_bg "ipsec-connections" "oci network ip-sec-connection list"
run_export_bg "cross-connect-groups" "oci network cross-connect-group list"
run_export_bg "cross-connects" "oci network cross-connect list"
run_export_bg "virtual-circuits" "oci network virtual-circuit list"
run_export_bg "remote-peering-connections" "oci network remote-peering-connection list"
run_export_bg "private-ips" "oci network private-ip list"
run_export_bg "vtaps" "oci network vtap list"
run_export_bg "capture-filters" "oci network capture-filter list"
run_export_bg "byoip-ranges" "oci network byoip-range list"
run_export_bg "public-ip-pools" "oci network public-ip-pool list"
run_export_bg "network-firewalls" "oci network-firewall network-firewall list"
run_export_bg "network-firewall-policies" "oci network-firewall network-firewall-policy list"
wait_all

# NSG rules require iterating each NSG.
EXPORT_COUNT=$((EXPORT_COUNT + 1))
echo -n "  [$EXPORT_COUNT] Exporting nsg-rules (per-NSG)..."
_nsg_outfile="$OUTPUT_DIR/nsg-rules.json"
_nsg_td=$(mktemp -d)
_nsg_i=0
_nsg_hits=0

if [ -f "$OUTPUT_DIR/nsgs.json" ]; then
  _nsg_ids=$(jq -r '.data[]?.id // empty' "$OUTPUT_DIR/nsgs.json" 2>/dev/null || true)
  if [ -n "$_nsg_ids" ]; then
    while IFS= read -r _nsg_id; do
      [ -z "$_nsg_id" ] && continue
      oci network nsg rules list \
        --nsg-id "$_nsg_id" \
        --all $REGION_FLAG 2>>"$ERROR_LOG" \
        | jq '.data // []' > "$_nsg_td/part_${_nsg_i}.json" 2>/dev/null || true
      if jq -e 'length > 0' "$_nsg_td/part_${_nsg_i}.json" >/dev/null 2>&1; then
        _nsg_hits=$((_nsg_hits + 1))
      else
        rm -f "$_nsg_td/part_${_nsg_i}.json"
      fi
      _nsg_i=$((_nsg_i + 1))
    done <<< "$_nsg_ids"
  fi
  echo -n " ($_nsg_hits NSGs had rules)"
  merge_parts "$_nsg_td" "$_nsg_outfile" || echo " EMPTY (skipping)"
else
  echo " SKIPPED (no nsgs.json)"
fi
rm -rf "$_nsg_td"

run_export "public-ips" "oci network public-ip list --scope REGION"
run_export_per_parent "drg-route-tables" "oci network drg-route-table list --drg-id" "drgs" '.id'
run_export_per_parent "drg-route-distributions" "oci network drg-route-distribution list --drg-id" "drgs" '.id'

# DRG route rules require iterating each DRG route table.
EXPORT_COUNT=$((EXPORT_COUNT + 1))
echo -n "  [$EXPORT_COUNT] Exporting drg-route-rules (per-route-table)..."
_drr_outfile="$OUTPUT_DIR/drg-route-rules.json"
_drr_td=$(mktemp -d)
_drr_i=0
_drr_hits=0

if [ -f "$OUTPUT_DIR/drg-route-tables.json" ]; then
  _drr_ids=$(jq -r '.data[]?.id // empty' "$OUTPUT_DIR/drg-route-tables.json" 2>/dev/null || true)
  if [ -n "$_drr_ids" ]; then
    while IFS= read -r _drr_id; do
      [ -z "$_drr_id" ] && continue
      oci network drg-route-rule list \
        --drg-route-table-id "$_drr_id" \
        --all $REGION_FLAG 2>>"$ERROR_LOG" \
        | jq '.data // []' > "$_drr_td/part_${_drr_i}.json" 2>/dev/null || true
      if jq -e 'length > 0' "$_drr_td/part_${_drr_i}.json" >/dev/null 2>&1; then
        _drr_hits=$((_drr_hits + 1))
      else
        rm -f "$_drr_td/part_${_drr_i}.json"
      fi
      _drr_i=$((_drr_i + 1))
    done <<< "$_drr_ids"
  fi
  echo -n " ($_drr_hits tables had rules)"
  merge_parts "$_drr_td" "$_drr_outfile" || echo " EMPTY (skipping)"
else
  echo " SKIPPED (no drg-route-tables.json)"
fi
rm -rf "$_drr_td"

# ===================================================================
# Storage
# ===================================================================
echo ""
echo "=== Storage ==="
run_export_bg "block-volumes" "oci bv volume list"
run_export_per_ad "boot-volumes" "oci bv boot-volume list"
run_export_bg "volume-backups" "oci bv backup list"
run_export_bg "volume-groups" "oci bv volume-group list"
run_export_per_ad "file-systems" "oci fs file-system list"
run_export "buckets" "oci os bucket list"
run_export_per_ad "mount-targets" "oci fs mount-target list"
wait_all
run_export_per_bucket "preauth-requests" "oci os preauth-request list"
run_export_per_bucket "lifecycle-policies" "oci os object-lifecycle-policy get"
run_export_per_bucket "replication-policies" "oci os replication policy list"

# ===================================================================
# Database
# ===================================================================
echo ""
echo "=== Database ==="
run_export "db-systems" "oci db system list"
run_export "autonomous-databases" "oci db autonomous-database list"
run_export_bg "mysql-db-systems" "oci mysql db-system list"
run_export "db-homes" "oci db db-home list"
run_export_bg "db-backups" "oci db backup list"
run_export_bg "autonomous-db-backups" "oci db autonomous-database-backup list"
run_export_bg "autonomous-container-databases" "oci db autonomous-container-database list"
run_export_bg "pluggable-databases" "oci db pluggable-database list"
run_export_bg "exadata-infrastructures" "oci db exadata-infrastructure list"
run_export_bg "cloud-vm-clusters" "oci db cloud-vm-cluster list"
run_export_bg "cloud-exa-infras" "oci db cloud-exa-infra list"
run_export_bg "db-software-images" "oci db database-software-image list"
run_export_bg "db-key-stores" "oci db key-store list"
run_export_bg "maintenance-runs" "oci db maintenance-run list"
run_export_bg "nosql-tables" "oci nosql table list"
wait_all
run_export_per_parent "databases" "oci db database list --db-home-id" "db-homes" '.id'
run_export_per_parent "db-nodes" "oci db node list --db-system-id" "db-systems" '.id'
wait_all
run_export_per_parent "data-guard-associations" "oci db data-guard-association list --database-id" "databases" '.id'

# ===================================================================
# Database — Managed
# ===================================================================
echo ""
echo "=== Database — Managed ==="
run_export_bg "redis-clusters" "oci redis redis-cluster list-redis-clusters"
run_export_bg "opensearch-clusters" "oci opensearch cluster list"
run_export "psql-db-systems" "oci psql db-system-collection list-db-systems"
run_export_bg "psql-backups" "oci psql backup-collection list-backups"
wait_all

# ===================================================================
# Load Balancer
# ===================================================================
echo ""
echo "=== Load Balancer ==="
run_export "load-balancers" "oci lb load-balancer list"
run_export_bg "network-load-balancers" "oci nlb network-load-balancer list"
wait_all

# ===================================================================
# Containers / OKE
# ===================================================================
echo ""
echo "=== Containers ==="
run_export "oke-clusters" "oci ce cluster list"
run_export_per_parent "node-pools" "oci ce node-pool list --cluster-id" "oke-clusters" '.id'
run_export "container-instances" "oci container-instances container-instance list"
# Container repos: OCI may return {"data": {"items": [...]}} format.
# Use a custom export to normalize the response.
EXPORT_COUNT=$((EXPORT_COUNT + 1))
echo -n "  [$EXPORT_COUNT] Exporting container-repos..."
_cr_outfile="$OUTPUT_DIR/container-repos.json"
_cr_td=$(mktemp -d)
_cr_i=0
_cr_hits=0

for cid in "${COMPARTMENT_IDS[@]}"; do
  oci artifacts container repository list \
    --compartment-id "$cid" \
    --all $REGION_FLAG 2>>"$ERROR_LOG" \
    | jq '(.data.items // .data // [])' > "$_cr_td/part_${_cr_i}.json" 2>/dev/null || true
  if jq -e 'length > 0' "$_cr_td/part_${_cr_i}.json" >/dev/null 2>&1; then
    _cr_hits=$((_cr_hits + 1))
  else
    rm -f "$_cr_td/part_${_cr_i}.json"
  fi
  _cr_i=$((_cr_i + 1))
done
echo -n " ($_cr_hits compartments had repos)"
merge_parts "$_cr_td" "$_cr_outfile" || echo " EMPTY (skipping)"
rm -rf "$_cr_td"

# Container images: list per compartment (each compartment covers all its repos).
# The OCI API returns {"data": {"items": [...]}} for container image list.
EXPORT_COUNT=$((EXPORT_COUNT + 1))
echo -n "  [$EXPORT_COUNT] Exporting container-images (per-compartment)..."
_ci_outfile="$OUTPUT_DIR/container-images.json"
_ci_td=$(mktemp -d)
_ci_i=0
_ci_hits=0

# Collect unique compartment IDs from repos we already exported.
# Response format may be {"data": [...]} or {"data": {"items": [...]}}.
_ci_compartments=""
if [ -f "$OUTPUT_DIR/container-repos.json" ]; then
  # merge_parts outputs {"data": [...]}, so .data is always an array
  _ci_compartments=$(jq -r '.data[]?."compartment-id" // empty' "$OUTPUT_DIR/container-repos.json" 2>/dev/null | sort -u || true)
fi

# Fall back to the full compartment list if no repos file or no compartments found
if [ -z "$_ci_compartments" ]; then
  _ci_compartments=$(printf '%s\n' "${COMPARTMENT_IDS[@]}")
fi

if [ -n "$_ci_compartments" ]; then
  while IFS= read -r _ci_cid; do
    [ -z "$_ci_cid" ] && continue
    # OCI container image list returns {"data": {"items": [...]}}
    oci artifacts container image list \
      --compartment-id "$_ci_cid" \
      --all $REGION_FLAG 2>>"$ERROR_LOG" \
      | jq '(.data.items // .data // [])' > "$_ci_td/part_${_ci_i}.json" 2>/dev/null || true
    if jq -e 'length > 0' "$_ci_td/part_${_ci_i}.json" >/dev/null 2>&1; then
      _ci_hits=$((_ci_hits + 1))
    else
      rm -f "$_ci_td/part_${_ci_i}.json"
    fi
    _ci_i=$((_ci_i + 1))
  done <<< "$_ci_compartments"
fi
echo -n " ($_ci_hits compartments had images)"
merge_parts "$_ci_td" "$_ci_outfile" || echo " EMPTY (skipping)"
rm -rf "$_ci_td"

# Image signatures: also uses {"data": {"items": [...]}} format
EXPORT_COUNT=$((EXPORT_COUNT + 1))
echo -n "  [$EXPORT_COUNT] Exporting image-signatures..."
_is_outfile="$OUTPUT_DIR/image-signatures.json"
_is_td=$(mktemp -d)
_is_i=0
_is_hits=0

for cid in "${COMPARTMENT_IDS[@]}"; do
  oci artifacts container image-signature list \
    --compartment-id "$cid" \
    --all $REGION_FLAG 2>>"$ERROR_LOG" \
    | jq '(.data.items // .data // [])' > "$_is_td/part_${_is_i}.json" 2>/dev/null || true
  if jq -e 'length > 0' "$_is_td/part_${_is_i}.json" >/dev/null 2>&1; then
    _is_hits=$((_is_hits + 1))
  else
    rm -f "$_is_td/part_${_is_i}.json"
  fi
  _is_i=$((_is_i + 1))
done
echo -n " ($_is_hits compartments had signatures)"
merge_parts "$_is_td" "$_is_outfile" || echo " EMPTY (skipping)"
rm -rf "$_is_td"

# ===================================================================
# Serverless
# ===================================================================
echo ""
echo "=== Serverless ==="
run_export "functions-applications" "oci fn application list"
run_export_per_parent "functions" "oci fn function list --application-id" "functions-applications" '.id'
run_export "api-gateways" "oci api-gateway gateway list"
run_export_per_parent "api-deployments" "oci api-gateway deployment list --gateway-id" "api-gateways" '.id'

# ===================================================================
# Security
# ===================================================================
echo ""
echo "=== Security ==="
run_export_bg "vaults" "oci kms management vault list"
run_export_bg "secrets" "oci vault secret list"
run_export_bg "container-scan-results" "oci vulnerability-scanning container-scan-result list"
run_export_bg "waf-policies" "oci waf web-app-firewall list"
run_export_bg "bastions" "oci bastion bastion list"
run_export_bg "certificates" "oci certs-mgmt certificate list"
run_export_bg "cloud-guard-targets" "oci cloud-guard target list"
run_export_bg "cloud-guard-detector-recipes" "oci cloud-guard detector-recipe list"
run_export_bg "waas-policies" "oci waas waas-policy list"
run_export_bg "waas-certificates" "oci waas certificate list"
run_export_bg "dr-protection-groups" "oci disaster-recovery dr-protection-group list"
run_export_bg "dr-plans" "oci disaster-recovery dr-plan list"
wait_all

# ===================================================================
# Observability
# ===================================================================
echo ""
echo "=== Observability ==="
run_export "log-groups" "oci logging log-group list"
run_export_per_parent "logs" "oci logging log list --log-group-id" "log-groups" '.id'
run_export_bg "alarms" "oci monitoring alarm list"
run_export "notification-topics" "oci ons topic list"
run_export_per_parent "notification-subscriptions" "oci ons subscription list --topic-id" "notification-topics" '."topic-id"'
run_export_bg "events-rules" "oci events rule list"
run_export_bg "email-senders" "oci email sender list"
wait_all

# ===================================================================
# DNS
# ===================================================================
echo ""
echo "=== DNS ==="
run_export "dns-zones" "oci dns zone list"
run_export_bg "dns-views" "oci dns view list"
run_export "dns-resolvers" "oci dns resolver list"
run_export_bg "dns-steering-policies" "oci dns steering-policy list"
run_export_bg "dns-steering-policy-attachments" "oci dns steering-policy-attachment list"
run_export_bg "dns-tsig-keys" "oci dns tsig-key list"
wait_all
run_export_per_parent "dns-resolver-endpoints" "oci dns resolver-endpoint list --resolver-id" "dns-resolvers" '.id'
run_export_per_parent "dns-records" "oci dns record zone get --zone-name-or-id" "dns-zones" '.id'

# ===================================================================
# DevOps
# ===================================================================
echo ""
echo "=== DevOps ==="
run_export "devops-projects" "oci devops project list"
wait_all
run_export_per_parent "devops-build-pipelines" "oci devops build-pipeline list --project-id" "devops-projects" '.id'
run_export_per_parent "devops-deploy-pipelines" "oci devops deploy-pipeline list --project-id" "devops-projects" '.id'
run_export_per_parent "devops-repositories" "oci devops repository list --project-id" "devops-projects" '.id'

# ===================================================================
# Messaging
# ===================================================================
echo ""
echo "=== Messaging ==="
run_export_bg "streams" "oci streaming stream list"
run_export_bg "connect-harnesses" "oci streaming connect-harness list"
run_export_bg "service-connectors" "oci sch service-connector list"
run_export_bg "queues" "oci queue queue list"
wait_all

# ===================================================================
# Governance
# ===================================================================
echo ""
echo "=== Governance ==="
run_export_bg "resource-manager-stacks" "oci resource-manager stack list"
run_export_bg "budgets" "oci budgets budget list"
run_export_bg "quotas" "oci limits quota list"
wait_all

# ===================================================================
# Health & Monitoring
# ===================================================================
echo ""
echo "=== Health & Monitoring ==="
run_export_bg "health-checks-http" "oci health-checks http-monitor list"
run_export_bg "health-checks-ping" "oci health-checks ping-monitor list"
run_export_bg "apm-domains" "oci apm-control-plane apm-domain list"
wait_all

echo ""
echo "=== Done ==="
echo "Exported $EXPORT_COUNT resource types to: $OUTPUT_DIR"

# ---------------------------------------------------------------
# Error summary
# ---------------------------------------------------------------
if [ -s "$ERROR_LOG" ]; then
  _err_count=$(wc -l < "$ERROR_LOG")
  echo ""
  echo "=== Error Summary ==="
  echo "$_err_count error(s) logged to: $ERROR_LOG"
  echo "Last 10 errors:"
  tail -10 "$ERROR_LOG"
else
  rm -f "$ERROR_LOG"
fi

echo ""
echo "To import into OCI Visualizer:"
echo "  cd $OUTPUT_DIR && zip -r ../oci-export.zip *.json"
echo "  Then upload the ZIP file on the Import page."
