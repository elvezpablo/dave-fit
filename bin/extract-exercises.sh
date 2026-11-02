#!/usr/bin/env bash
#
# extract-exercises.sh
#
# Iterates through each numbered folder (folder-01 .. folder-N), runs the
# OpenCode CLI against images in the folder asking it to identify the exercise
# and which person (Paul / Dave / Jeremey) is shown. If the exercise cannot be
# determined from one photo, it tries the next photo in the same folder.
# Results are written to a markdown document.
#
# Usage:
#   ./extract-exercises.sh [output.md]
#
# Example:
#   ./extract-exercises.sh workout-exercises.md
#

set -uo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
OUTPUT_FILE="${1:-workout-exercises.md}"
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Image extensions to look for (matched case-insensitively).
IMAGE_EXTENSIONS=(jpg jpeg png webp gif)

# Markers OpenCode is asked to include in its reply.
UNDETERMINED_MARKER="EXERCISE: undetermined"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log()  { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*" >&2; }
err()  { printf '[ERROR] %s\n' "$*" >&2; }

# Strip ANSI escape codes, the leading ">" prompt markers, the model header
# line, and opencode tool-call artifacts (lines starting with "→", "✱", "$ ").
# Keep only the first EXERCISE: block (opencode sometimes echoes the response
# twice with slight variations). Keeps only the assistant's actual text response.
clean_output() {
  sed -E 's/\x1b\[[0-9;]*m//g; s/^>\s*//; /^[[:space:]]*build ·/d; /^→/d; /^✱/d; /^\$ /d; /^[[:space:]]*$/d' \
    | awk '/^EXERCISE:/ { if (block_seen++) { skip=1 } else { skip=0 } } skip { next } { print }'
}

# ---------------------------------------------------------------------------
# Validate
# ---------------------------------------------------------------------------
if ! command -v opencode >/dev/null 2>&1; then
  err "opencode CLI not found on PATH. Install it first."
  exit 1
fi

# ---------------------------------------------------------------------------
# Prepare output markdown file
# ---------------------------------------------------------------------------
{
  printf '# Workout Exercise Extraction\n\n'
  printf 'Generated: %s\n\n' "$(date '+%Y-%m-%d %H:%M:%S')"
  printf 'Source directory: %s\n\n' "$BASE_DIR"
  printf 'People reference: Paul (Hispanic), Dave (tallest), Jeremey (the other one)\n\n'
  printf '---\n\n'
} > "$OUTPUT_FILE"

log "Writing results to $OUTPUT_FILE"

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
shopt -s nullglob

folder_count=0
image_count=0
determined_count=0
undetermined_count=0
error_count=0

# Iterate folders in numeric order (folder-01, folder-02, ...).
for dir in "$BASE_DIR"/folder-*/; do
  [[ -d "$dir" ]] || continue
  folder_name="$(basename "$dir")"
  folder_count=$((folder_count + 1))

  log "Processing $folder_name ..."
  {
    printf '## %s\n\n' "$folder_name"
  } >> "$OUTPUT_FILE"

  # Collect image files, sorted by name.
  images=()
  for ext in "${IMAGE_EXTENSIONS[@]}"; do
    while IFS= read -r -d '' f; do
      images+=("$f")
    done < <(find "$dir" -maxdepth 1 -type f -iname "*.$ext" -print0 | sort -z)
  done

  folder_determined=0

  if [[ ${#images[@]} -eq 0 ]]; then
    {
      printf '_No image files found in this folder._\n\n'
      printf '%s\n\n' '---'
    } >> "$OUTPUT_FILE"
    undetermined_count=$((undetermined_count + 1))
    continue
  fi

  for img in "${images[@]}"; do
    [[ -f "$img" ]] || continue
    image_count=$((image_count + 1))
    img_name="$(basename "$img")"

    log "  -> $img_name"

    {
      printf '### Photo: %s\n\n' "$img_name"
      printf '![%s](%s)\n\n' "$img_name" "$img"
    } >> "$OUTPUT_FILE"

    PROMPT='Identify the exercise being performed in this photo. Also identify which person it is: Paul (Hispanic), Dave (tallest), or Jeremey (the other one).

Reply in this exact format:
EXERCISE: <exercise name or "undetermined">
PERSON: <Paul/Dave/Jeremey/undetermined>
REASONING: <brief description of what you see>

If the image is too unclear to identify the exercise, set EXERCISE to "undetermined".'

    ERR_FILE="$(mktemp)"
    if raw_output="$(opencode run --file "$img" "$PROMPT" 2>"$ERR_FILE")"; then
      output="$(printf '%s' "$raw_output" | clean_output)"
    else
      error_count=$((error_count + 1))
      err "  opencode failed for $img_name"
      {
        printf '*opencode failed to process this image.*\n\n'
        printf '%s\n\n' '---'
      } >> "$OUTPUT_FILE"
      rm -f "$ERR_FILE"
      continue
    fi
    rm -f "$ERR_FILE"

    # Write the full description to the markdown.
    {
      printf '%s\n\n' "$output"
    } >> "$OUTPUT_FILE"

    # Check whether OpenCode determined the exercise.
    if printf '%s' "$output" | grep -iq "^EXERCISE: *undetermined"; then
      log "  -> exercise undetermined, trying next photo..."
      {
        printf '_Exercise could not be determined from this photo; trying next photo...\n\n_'
        printf '%s\n\n' '---'
      } >> "$OUTPUT_FILE"
      continue
    fi

    # Exercise determined — stop trying more photos in this folder.
    folder_determined=1
    determined_count=$((determined_count + 1))
    log "  -> exercise determined."
    {
      printf '%s\n\n' '---'
    } >> "$OUTPUT_FILE"
    break
  done

  if [[ "$folder_determined" -eq 0 ]]; then
    undetermined_count=$((undetermined_count + 1))
    {
      printf '_Exercise could not be determined from any photo in this folder._\n\n'
      printf '%s\n\n' '---'
    } >> "$OUTPUT_FILE"
  fi
done

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
{
  printf '\n---\n\n'
  printf '## Summary\n\n'
  printf '- Folders processed: %d\n' "$folder_count"
  printf '- Images examined: %d\n' "$image_count"
  printf '- Exercises determined: %d\n' "$determined_count"
  printf '- Exercises undetermined: %d\n' "$undetermined_count"
  printf '- Errors: %d\n' "$error_count"
  printf '- Output file: %s\n' "$OUTPUT_FILE"
} >> "$OUTPUT_FILE"

log "Done. Folders: $folder_count, Images examined: $image_count, Determined: $determined_count, Undetermined: $undetermined_count, Errors: $error_count"
log "Output written to $OUTPUT_FILE"
