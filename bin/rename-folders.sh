#!/usr/bin/env bash
#
# rename-folders.sh
#
# Renames folder-01..folder-38 based on the EXERCISE line found in
# workout-exercises.md. Names are sanitized (no spaces/special chars) and
# made unique by appending the original folder number when needed.
# Also removes workout-metadata.md.err and workout-metadata.md.tmp files.
#

set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MD_FILE="$BASE_DIR/workout-exercises.md"

if [[ ! -f "$MD_FILE" ]]; then
  echo "ERROR: $MD_FILE not found." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Parse the markdown: for each folder-NN, capture the LAST EXERCISE: line
# (so if the first photo was "undetermined" but a later one was determined,
# we use the determined one).
# ---------------------------------------------------------------------------
declare -A exercise
current_folder=""

while IFS= read -r line; do
  # Detect "## folder-NN" header
  if [[ "$line" =~ ^\ ##\ folder-([0-9]+) ]]; then
    current_folder="${BASH_REMATCH[1]}"
    exercise["$current_folder"]=""
    continue
  fi

  # Detect "EXERCISE: ..." line
  if [[ "$line" =~ ^EXERCISE:[[:space:]]*(.*) ]] && [[ -n "$current_folder" ]]; then
    exercise["$current_folder"]="${BASH_REMATCH[1]}"
  fi
done < "$MD_FILE"

# ---------------------------------------------------------------------------
# Sanitize and rename
# ---------------------------------------------------------------------------
declare -A used_names
renamed=0
skipped=0

for ((f=1; f<=38; f++)); do
  folder_num=$(printf '%02d' "$f")
  raw="${exercise[$folder_num]:-}"

  # Take text before "(" if present, trim whitespace
  clean="${raw%%(*)}"
  # Trim leading/trailing whitespace
  clean="${clean#"${clean%%[![:space:]]*}"}"
  clean="${clean%"${clean##*[![:space:]]}"}"

  # Lowercase, replace non-alphanumeric with hyphens, collapse hyphens, trim
  sanitized=$(printf '%s' "$clean" \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9]/-/g; s/-\+/-/g; s/^-//; s/-$//')

  if [[ -z "$sanitized" || "$sanitized" == "undetermined" ]]; then
    sanitized="undetermined"
  fi

  old_dir="$BASE_DIR/folder-$folder_num"

  if [[ ! -d "$old_dir" ]]; then
    echo "WARNING: $old_dir does not exist, skipping."
    skipped=$((skipped + 1))
    continue
  fi

  # Make unique: if name already used, append folder number
  final_name="$sanitized"
  if [[ -n "${used_names[$sanitized]:-}" ]]; then
    final_name="${sanitized}-${folder_num}"
  fi
  used_names["$final_name"]=1

  new_dir="$BASE_DIR/$final_name"

  if [[ "$old_dir" == "$new_dir" ]]; then
    echo "SKIP: $old_dir already named '$final_name'"
    continue
  fi

  if [[ -e "$new_dir" ]]; then
    echo "WARNING: $new_dir already exists, skipping $old_dir."
    skipped=$((skipped + 1))
    continue
  fi

  mv "$old_dir" "$new_dir"
  echo "RENAMED: folder-$folder_num -> $final_name  (exercise: $raw)"
  renamed=$((renamed + 1))
done

# ---------------------------------------------------------------------------
# Remove error/temp files from all folders
# ---------------------------------------------------------------------------
removed=0
while IFS= read -r -d '' f; do
  rm -f "$f"
  removed=$((removed + 1))
done < <(find "$BASE_DIR" -maxdepth 2 -type f \( -name 'workout-metadata.md.err' -o -name 'workout-metadata.md.tmp' \) -print0)

echo ""
echo "Done. Renamed: $renamed, Skipped: $skipped, Error/temp files removed: $removed"
