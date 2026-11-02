#!/usr/bin/env bash
#
# analyze-workout-image.sh
#
# Uploads ONE image to the Crusoe Inference API (OpenAI-compatible
# /v1/chat/completions) as a base64 data URI and asks a vision model to
# analyze the workout shown in the photo.
#
# Usage:
#   ./analyze-workout-image.sh [options] <image-path>
#   ./analyze-workout-image.sh --list-models
#
# Options:
#   -m, --model MODEL     Model id (default: $CRUSOE_MODEL or the built-in default)
#   -o, --out FILE        Write the analysis to FILE instead of stdout
#   -p, --prompt TEXT     Override the analysis prompt
#   -j, --json            Print the raw API JSON response instead of just the text
#   -s, --stream          Stream the response (Accept: text/event-stream)
#       --list-models     List models available to your API key, then exit
#   -h, --help            Show this help
#
# Environment:
#   CRUSOE_AI_API_KEY     Required. Your Crusoe inference API key.
#   CRUSOE_MODEL          Optional. Default model id.
#   CRUSOE_API_BASE       Optional. Default: https://api.inference.crusoecloud.com/v1
#

set -euo pipefail

###############################################################################
# Configuration
###############################################################################
API_BASE="${CRUSOE_API_BASE:-https://api.inference.crusoecloud.com/v1}"
# Must be a vision-capable model. Run --list-models to see what your key has.
# Known vision models on this endpoint: nvidia/NVIDIA-Nemotron-3.5-Super-VL,
# google/gemma-4-31b-it, nvidia/Nemotron-3-Nano-Omni-Reasoning-30B-A3B.
MODEL="${CRUSOE_MODEL:-nvidia/NVIDIA-Nemotron-3.5-Super-VL}"
OUT=""
RAW_JSON=0
STREAM=0
IMAGE=""

read -r -d '' DEFAULT_PROMPT <<'EOF' || true
You are a fitness coach analyzing a single photo of someone performing an exercise.

Note: the photo may be rotated (phone EXIF orientation); mentally re-orient it
before judging body position.

Return ONLY a markdown block with these fields, using "unknown" when the image
does not show enough to answer:

- **Exercise name**: the most likely exercise or movement
- **Movement pattern**: e.g. hinge, squat, push, pull, carry, rotation, isometric, mobility
- **Phase**: start / mid-rep / end / hold
- **Equipment**: barbell, dumbbell, kettlebell, band, machine, bodyweight, mat, etc.
- **Primary muscles**
- **Secondary muscles**
- **Body position**: stance, grip, spine/joint angles you can actually see
- **Form notes**: what looks correct and what looks off
- **Coaching cues**: 2-3 short cues to improve the position
- **Setting**: gym / home / studio / outdoors, plus anything legible (signage, screens, timers, weights)
- **Suggested sets/reps**: a reasonable prescription for this movement

Do not add any chatter outside the metadata block.
EOF
PROMPT="$DEFAULT_PROMPT"

###############################################################################
# Helpers
###############################################################################
err()  { printf '\033[31mERROR\033[0m %s\n' "$*" >&2; }
usage() { sed -n '3,30p' "$0" | sed 's/^# \{0,1\}//'; }

mime_for() {
  case "$(printf '%s' "${1##*.}" | tr '[:upper:]' '[:lower:]')" in
    jpg|jpeg) echo "image/jpeg" ;;
    png)      echo "image/png"  ;;
    webp)     echo "image/webp" ;;
    gif)      echo "image/gif"  ;;
    heic|heif) echo "image/heic" ;;
    *)        echo "application/octet-stream" ;;
  esac
}

###############################################################################
# Argument parsing
###############################################################################
LIST_MODELS=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--model)   MODEL="$2"; shift 2 ;;
    -o|--out)     OUT="$2"; shift 2 ;;
    -p|--prompt)  PROMPT="$2"; shift 2 ;;
    -j|--json)    RAW_JSON=1; shift ;;
    -s|--stream)  STREAM=1; shift ;;
    --list-models) LIST_MODELS=1; shift ;;
    -h|--help)    usage; exit 0 ;;
    -*)           err "Unknown option: $1"; usage; exit 1 ;;
    *)            IMAGE="$1"; shift ;;
  esac
done

###############################################################################
# Preflight
###############################################################################
for bin in curl jq base64; do
  command -v "$bin" >/dev/null 2>&1 || { err "$bin not found on PATH"; exit 1; }
done

if [[ -z "${CRUSOE_AI_API_KEY:-}" ]]; then
  err "CRUSOE_AI_API_KEY is not set. Export it first:"
  err "  export CRUSOE_AI_API_KEY='...'"
  exit 1
fi

if [[ "$LIST_MODELS" == "1" ]]; then
  curl -sS "$API_BASE/models" \
    -H "Authorization: Bearer $CRUSOE_AI_API_KEY" \
    | jq -r '.data[]?.id // empty' | sort
  exit 0
fi

if [[ -z "$IMAGE" ]]; then
  err "No image path given."
  usage
  exit 1
fi

if [[ ! -f "$IMAGE" ]]; then
  err "Image not found: $IMAGE"
  exit 1
fi

###############################################################################
# Build the request
###############################################################################
MIME="$(mime_for "$IMAGE")"
# macOS/BSD and GNU base64 both accept stdin; strip any wrapping newlines.
B64="$(base64 < "$IMAGE" | tr -d '\n')"

PAYLOAD_FILE="$(mktemp -t crusoe-payload)"
trap 'rm -f "$PAYLOAD_FILE"' EXIT

jq -n \
  --arg model "$MODEL" \
  --arg prompt "$PROMPT" \
  --arg data_uri "data:$MIME;base64,$B64" \
  --argjson stream "$STREAM" \
  '{
     model: $model,
     stream: ($stream == 1),
     # Generous: the VL models are reasoning models and spend most of the
     # budget on reasoning_tokens before emitting any visible content.
     max_tokens: 3000,
     temperature: 0.2,
     messages: [
       {
         role: "user",
         content: [
           { type: "text", text: $prompt },
           { type: "image_url", image_url: { url: $data_uri } }
         ]
       }
     ]
   }' > "$PAYLOAD_FILE"

###############################################################################
# Call the API
###############################################################################
if [[ "$STREAM" == "1" ]]; then
  curl -sS "$API_BASE/chat/completions" \
    -X POST \
    -H "Authorization: Bearer $CRUSOE_AI_API_KEY" \
    -H 'Content-Type: application/json' \
    -H 'Accept: text/event-stream' \
    --data-binary "@$PAYLOAD_FILE" \
  | while IFS= read -r line; do
      [[ "$line" == data:* ]] || continue
      chunk="${line#data: }"
      [[ "$chunk" == "[DONE]" ]] && break
      printf '%s' "$(jq -r '.choices[0].delta.content // empty' <<<"$chunk" 2>/dev/null)"
    done
  printf '\n'
  exit 0
fi

RESPONSE="$(curl -sS "$API_BASE/chat/completions" \
  -X POST \
  -H "Authorization: Bearer $CRUSOE_AI_API_KEY" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  --data-binary "@$PAYLOAD_FILE")"

# Surface API errors instead of printing "null".
if jq -e 'has("error") or has("errors")' >/dev/null 2>&1 <<<"$RESPONSE"; then
  err "API returned an error:"
  jq . <<<"$RESPONSE" >&2
  exit 1
fi

if [[ "$RAW_JSON" == "1" ]]; then
  OUTPUT="$(jq . <<<"$RESPONSE")"
else
  OUTPUT="$(jq -r '.choices[0].message.content // empty' <<<"$RESPONSE")"
  if [[ -z "$OUTPUT" ]]; then
    err "Empty completion. Raw response:"
    jq . <<<"$RESPONSE" >&2
    exit 1
  fi
fi

if [[ -n "$OUT" ]]; then
  printf '%s\n' "$OUTPUT" > "$OUT"
  printf 'Wrote analysis to %s\n' "$OUT"
else
  printf '%s\n' "$OUTPUT"
fi
