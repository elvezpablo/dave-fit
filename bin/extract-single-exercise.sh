#!/usr/bin/env bash
#
# extract-single-exercise.sh
#
# Runs the OpenCode CLI against every JPG/JPEG image found under a directory
# (recursively), identifying the exercise and which person is shown
# (Paul / Dave / Jeremey). Writes a markdown file next to each image, named
# the same as the image file (e.g. photo.jpg -> photo.md).
#
# Extracted from bin/extract-exercises.sh for prompt/output experimentation.
#
# Usage:
#   ./extract-single-exercise.sh [directory] [prompt-file]
#
#   directory   Directory to scan for images (defaults to current directory).
#   prompt-file Optional file whose contents are used as the prompt.
#
# Example:
#   ./extract-single-exercise.sh ./folder-01
#   ./extract-single-exercise.sh . my-prompt.txt
#

set -uo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

DIR="${1:-.}"
PROMPT_FILE="${2:-}"

if [[ ! -d "$DIR" ]]; then
  err "Directory not found: $DIR"
  exit 1
fi

# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------
if [[ -n "$PROMPT_FILE" && -f "$PROMPT_FILE" ]]; then
  PROMPT="$(cat "$PROMPT_FILE")"
else
  PROMPT='Identify the exercise being performed in this photo. Read the other markdown files in this directory if there are any to help you.

Reply in this exact format:
EXERCISE: <exercise name or "undetermined">
REASONING: <brief description of what you see>

If the image is too unclear to identify the exercise, set EXERCISE to "undetermined".'
fi

# ---------------------------------------------------------------------------
# Collect images (recursive, case-insensitive jpg/jpeg)
# ---------------------------------------------------------------------------
shopt -s nullglob

images=()
while IFS= read -r -d '' f; do
  images+=("$f")
done < <(find "$DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" \) -print0 | sort -z)

if [[ ${#images[@]} -eq 0 ]]; then
  err "No JPG/JPEG images found under $DIR"
  exit 1
fi

log "Found ${#images[@]} image(s) under $DIR"

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
total=${#images[@]}
processed=0
succeeded=0
errors=0

for img in "${images[@]}"; do
  [[ -f "$img" ]] || continue
  processed=$((processed + 1))

  img_dir="$(dirname "$img")"
  img_base="$(basename "$img")"
  # Strip the final extension so photo.jpeg -> photo, photo.jpg -> photo.
  md_base="${img_base%.*}"
  md_file="$img_dir/${md_base}.md"

  log "[$processed/$total] $img_base"

  ERR_FILE="$(mktemp)"
  if raw_output="$(opencode run --file "$img" "$PROMPT" 2>"$ERR_FILE")"; then
    output="$(printf '%s' "$raw_output" | clean_output)"
  else
    errors=$((errors + 1))
    err "opencode failed for $img_base"
    {
      printf 'Source: %s\n\n' "$img_base"
      printf '*opencode failed to process this image.*\n\n'
    } > "$md_file"
    rm -f "$ERR_FILE"
    continue
  fi
  rm -f "$ERR_FILE"

  {
    printf 'Source: %s\n\n' "$img_base"
    printf '![%s](%s)\n\n' "$img_base" "$img"
    printf '%s\n' "$output"
  } > "$md_file"

  succeeded=$((succeeded + 1))
done

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
log "Done. Processed: $processed, Succeeded: $succeeded, Errors: $errors"
