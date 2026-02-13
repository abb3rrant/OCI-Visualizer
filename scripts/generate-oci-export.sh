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
# merge_parts: combine per-chunk JSON array files into one output
# Each part file contains a JSON array. Result: {"data": [...merged...]}
# Streams through files on disk instead of accumulating in memory.
# ---------------------------------------------------------------
merge_parts() {
  local td="$1" outfile="$2"
  local parts=("$td"/part_*.json)
  if [ ! -e "${parts[0]}" ]; then return 1; fi
  # Merge all arrays and wrap in envelope
  jq -s 'add' "$td"/part_*.json | jq '{data:.}' > "$outfile" 2>/dev/null
  # Verify output has data (jq on empty files exits 0 with no output, so check -s first)
  if [ -s "$outfile" ] && jq -e '.data and (.data|length) > 0' "$outfile" >/dev/null 2>&1; then
    local cnt
    cnt=$(jq '.data | length' "$outfile" 2>/dev/null)
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
  local outfile="$OUTPUT_DIR/${name}.json"

  echo -n "  Exporting ${name}..."

  if [ ${#COMPARTMENT_IDS[@]} -eq 1 ]; then
    # Single compartment — pipe directly to file
    if eval "$cmd --compartment-id ${COMPARTMENT_IDS[0]} --all $REGION_FLAG" > "$outfile" 2>/dev/null; then
      local count
      count=$(jq '.data | length' "$outfile" 2>/dev/null || echo "?")
      echo " OK ($count items)"
    else
      echo " FAILED (skipping)"
      rm -f "$outfile"
    fi
  else
    # Multi-compartment — stream each result to a temp file
    local td
    td=$(mktemp -d)
    local i=0
    for cid in "${COMPARTMENT_IDS[@]}"; do
      eval "$cmd --compartment-id $cid --all $REGION_FLAG" 2>/dev/null \
        | jq '.data // []' > "$td/part_$i.json" 2>/dev/null || true
      # Remove empty arrays to save disk
      jq -e 'length > 0' "$td/part_$i.json" >/dev/null 2>&1 || rm -f "$td/part_$i.json"
      i=$((i + 1))
    done
    merge_parts "$td" "$outfile" || echo " EMPTY (skipping)"
    rm -rf "$td"
  fi
}

# ---------------------------------------------------------------
# run_export_per_ad: export resources that need --availability-domain
# ---------------------------------------------------------------
run_export_per_ad() {
  local name="$1"
  local cmd="$2"
  local outfile="$OUTPUT_DIR/${name}.json"

  echo -n "  Exporting ${name} (per-AD)..."

  local td
  td=$(mktemp -d)
  local i=0

  for cid in "${COMPARTMENT_IDS[@]}"; do
    local ads
    ads=$(oci iam availability-domain list --compartment-id "$cid" $REGION_FLAG 2>/dev/null | jq -r '.data[]?.name // empty' 2>/dev/null || true)
    [ -z "$ads" ] && continue

    while IFS= read -r ad; do
      [ -z "$ad" ] && continue
      eval "$cmd --compartment-id $cid --availability-domain \"$ad\" --all $REGION_FLAG" 2>/dev/null \
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

  local td
  td=$(mktemp -d)
  local i=0

  while IFS= read -r pid; do
    [ -z "$pid" ] && continue
    eval "$child_cmd $pid --all $REGION_FLAG" 2>/dev/null \
      | jq '.data // []' > "$td/part_$i.json" 2>/dev/null || true
    jq -e 'length > 0' "$td/part_$i.json" >/dev/null 2>&1 || rm -f "$td/part_$i.json"
    i=$((i + 1))
  done <<< "$parent_ids"

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
run_export "drg-attachments" "oci network drg-attachment list"
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
run_export_per_ad "file-systems" "oci fs file-system list"
run_export "buckets" "oci os bucket list"

# ===================================================================
# Database
# ===================================================================
echo ""
echo "=== Database ==="
run_export "db-systems" "oci db system list"
run_export "autonomous-databases" "oci db autonomous-database list"
run_export "mysql-db-systems" "oci mysql db-system list"
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
run_export_per_parent "node-pools" "oci ce node-pool list --cluster-id" "oke-clusters" '.id'
run_export "container-instances" "oci container-instances container-instance list"
run_export "container-repos" "oci artifacts container-repository list"
run_export "container-images" "oci artifacts container-image list"

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
