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

set -euo pipefail

# Defaults
COMPARTMENT_ID=""
COMPARTMENT_FILE=""
REGION=""
OUTPUT_DIR="./oci-export-$(date +%Y%m%d-%H%M%S)"

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

# Build compartment list
COMPARTMENT_IDS=()

if [ -n "$COMPARTMENT_FILE" ]; then
  if [ ! -f "$COMPARTMENT_FILE" ]; then
    echo "ERROR: Compartment file not found: $COMPARTMENT_FILE"
    exit 1
  fi
  while IFS= read -r line || [ -n "$line" ]; do
    line=$(echo "$line" | xargs)  # trim whitespace
    [ -z "$line" ] && continue
    [[ "$line" == \#* ]] && continue  # skip comments
    COMPARTMENT_IDS+=("$line")
  done < "$COMPARTMENT_FILE"
  if [ ${#COMPARTMENT_IDS[@]} -eq 0 ]; then
    echo "ERROR: No compartment OCIDs found in $COMPARTMENT_FILE"
    exit 1
  fi
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
echo "=== OCI Resource Export ==="
echo "Compartments: ${#COMPARTMENT_IDS[@]}"
for cid in "${COMPARTMENT_IDS[@]}"; do
  echo "  - $cid"
done
echo "Output: $OUTPUT_DIR"
echo ""

# ---------------------------------------------------------------
# Helper: run a command for one compartment, write to a temp file
# ---------------------------------------------------------------
run_single() {
  local cmd="$1"
  local cid="$2"
  local raw
  raw=$(eval "$cmd --compartment-id $cid --all $REGION_FLAG" 2>/dev/null || true)
  # OCI CLI sometimes prepends warnings/text before JSON — strip everything before first {
  if [ -n "$raw" ]; then
    echo "$raw" | sed -n '/^[[:space:]]*{/,$p'
  else
    echo '{"data":[]}'
  fi
}

# ---------------------------------------------------------------
# Helper: export a resource type across all compartments, merging
# ---------------------------------------------------------------
run_export() {
  local name="$1"
  local cmd="$2"
  local outfile="$OUTPUT_DIR/${name}.json"

  echo -n "  Exporting ${name}..."

  if [ ${#COMPARTMENT_IDS[@]} -eq 1 ]; then
    # Single compartment — simple case
    if eval "$cmd --compartment-id ${COMPARTMENT_IDS[0]} --all $REGION_FLAG" > "$outfile" 2>/dev/null; then
      local count
      count=$(jq '.data | length' "$outfile" 2>/dev/null || echo "?")
      echo " OK ($count items)"
    else
      echo " FAILED (skipping)"
      rm -f "$outfile"
    fi
  else
    # Multi-compartment — merge data arrays with jq
    local merged='[]'
    local ok=false
    for cid in "${COMPARTMENT_IDS[@]}"; do
      local result
      result=$(run_single "$cmd" "$cid")
      local items
      items=$(echo "$result" | jq -r '.data // []' 2>/dev/null || echo '[]')
      merged=$(echo "$merged" "$items" | jq -s '.[0] + .[1]')
      ok=true
    done
    if $ok && [ "$(echo "$merged" | jq 'length')" -gt 0 ]; then
      echo "{\"data\": $merged}" > "$outfile"
      echo " OK ($(echo "$merged" | jq 'length') items)"
    else
      echo " EMPTY (skipping)"
      rm -f "$outfile"
    fi
  fi
}

# ---------------------------------------------------------------
# Helper: export resources that need per-AD iteration
# (boot-volume-attachments, boot-volumes need --availability-domain)
# ---------------------------------------------------------------
run_export_per_ad() {
  local name="$1"
  local cmd="$2"
  local outfile="$OUTPUT_DIR/${name}.json"

  echo -n "  Exporting ${name} (per-AD)..."

  local merged='[]'
  local ok=false

  for cid in "${COMPARTMENT_IDS[@]}"; do
    # Discover availability domains for this compartment
    local ads
    ads=$(oci iam availability-domain list --compartment-id "$cid" $REGION_FLAG 2>/dev/null | jq -r '.data[]?.name // empty' 2>/dev/null || true)
    if [ -z "$ads" ]; then
      continue
    fi

    while IFS= read -r ad; do
      [ -z "$ad" ] && continue
      local result
      result=$(eval "$cmd --compartment-id $cid --availability-domain \"$ad\" --all $REGION_FLAG" 2>/dev/null || echo '{"data":[]}')
      local items
      items=$(echo "$result" | jq -r '.data // []' 2>/dev/null || echo '[]')
      merged=$(echo "$merged" "$items" | jq -s '.[0] + .[1]')
      ok=true
    done <<< "$ads"
  done

  if $ok && [ "$(echo "$merged" | jq 'length')" -gt 0 ]; then
    echo "{\"data\": $merged}" > "$outfile"
    echo " OK ($(echo "$merged" | jq 'length') items)"
  else
    echo " EMPTY (skipping)"
    rm -f "$outfile"
  fi
}

# ---------------------------------------------------------------
# Helper: export resources that need a parent resource ID
# e.g., functions need --application-id, node-pools need --cluster-id
# ---------------------------------------------------------------
run_export_per_parent() {
  local name="$1"
  local child_cmd="$2"
  local parent_file="$3"     # file we already exported that contains parent resources
  local parent_id_field="$4" # jq field to extract parent ID from (e.g., ".id")
  local outfile="$OUTPUT_DIR/${name}.json"

  echo -n "  Exporting ${name} (per-parent)..."

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

  local merged='[]'
  local ok=false

  while IFS= read -r pid; do
    [ -z "$pid" ] && continue
    local result
    result=$(eval "$child_cmd $pid --all $REGION_FLAG" 2>/dev/null || echo '{"data":[]}')
    local items
    items=$(echo "$result" | jq -r '.data // []' 2>/dev/null || echo '[]')
    merged=$(echo "$merged" "$items" | jq -s '.[0] + .[1]')
    ok=true
  done <<< "$parent_ids"

  if $ok && [ "$(echo "$merged" | jq 'length')" -gt 0 ]; then
    echo "{\"data\": $merged}" > "$outfile"
    echo " OK ($(echo "$merged" | jq 'length') items)"
  else
    echo " EMPTY (skipping)"
    rm -f "$outfile"
  fi
}

# ===================================================================
# IAM (most IAM resources are tenancy-scoped, use first compartment)
# ===================================================================
echo "=== IAM ==="
# Compartments with subtree traversal — run once per compartment ID
run_export "compartments" "oci iam compartment list --compartment-id-in-subtree true"
run_export "users" "oci iam user list"
run_export "groups" "oci iam group list"
run_export "policies" "oci iam policy list"
run_export "dynamic-groups" "oci iam dynamic-group list"

# ===================================================================
# Compute
# ===================================================================
echo ""
echo "=== Compute ==="
run_export "instances" "oci compute instance list"
run_export "images" "oci compute image list"
run_export "vnic-attachments" "oci compute vnic-attachment list"
run_export_per_ad "boot-volume-attachments" "oci compute boot-volume-attachment list"

# ===================================================================
# Networking
# ===================================================================
echo ""
echo "=== Networking ==="
run_export "vcns" "oci network vcn list"
run_export "subnets" "oci network subnet list"
run_export "security-lists" "oci network security-list list"
run_export "route-tables" "oci network route-table list"
run_export "nsgs" "oci network nsg list"
run_export "internet-gateways" "oci network internet-gateway list"
run_export "nat-gateways" "oci network nat-gateway list"
run_export "service-gateways" "oci network service-gateway list"
run_export "drgs" "oci network drg list"
run_export "local-peering-gateways" "oci network local-peering-gateway list"
run_export "dhcp-options" "oci network dhcp-options list"

# ===================================================================
# Storage
# ===================================================================
echo ""
echo "=== Storage ==="
run_export "block-volumes" "oci bv volume list"
run_export_per_ad "boot-volumes" "oci bv boot-volume list"
run_export "volume-backups" "oci bv backup list"
run_export "volume-groups" "oci bv volume-group list"
run_export "buckets" "oci os bucket list"

# ===================================================================
# Database
# ===================================================================
echo ""
echo "=== Database ==="
run_export "db-systems" "oci db system list"
run_export "autonomous-databases" "oci db autonomous-database list"
run_export "db-homes" "oci db db-home list"

# ===================================================================
# Load Balancer
# ===================================================================
echo ""
echo "=== Load Balancer ==="
run_export "load-balancers" "oci lb load-balancer list"

# ===================================================================
# Containers / OKE
# ===================================================================
echo ""
echo "=== Containers ==="
run_export "oke-clusters" "oci ce cluster list"
# Node pools require --cluster-id
run_export_per_parent "node-pools" "oci ce node-pool list --cluster-id" "oke-clusters" '.id'
run_export "container-instances" "oci container-instances container-instance list"

# ===================================================================
# Serverless
# ===================================================================
echo ""
echo "=== Serverless ==="
run_export "functions-applications" "oci fn application list"
# Functions require --application-id (not compartment-id)
run_export_per_parent "functions" "oci fn function list --application-id" "functions-applications" '.id'
run_export "api-gateways" "oci api-gateway gateway list"
# API deployments require --gateway-id
run_export_per_parent "api-deployments" "oci api-gateway deployment list --gateway-id" "api-gateways" '.id'

# ===================================================================
# DNS
# ===================================================================
echo ""
echo "=== DNS ==="
run_export "dns-zones" "oci dns zone list"

echo ""
echo "=== Done ==="
echo "Export complete! Files saved to: $OUTPUT_DIR"
echo ""
echo "To import into OCI Visualizer:"
echo "  cd $OUTPUT_DIR && zip -r ../oci-export.zip *.json"
echo "  Then upload the ZIP file on the Import page."
