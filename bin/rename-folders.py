#!/usr/bin/env python3
"""
rename-folders.py

Renames folder-01..folder-38 based on the EXERCISE line found in
workout-exercises.md. Names are sanitized (no spaces/special chars) and
made unique by appending the original folder number when needed.
Also removes workout-metadata.md.err and workout-metadata.md.tmp files.
"""

import os
import re
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MD_FILE = os.path.join(BASE_DIR, "workout-exercises.md")

if not os.path.isfile(MD_FILE):
    print(f"ERROR: {MD_FILE} not found.")
    raise SystemExit(1)

# ---------------------------------------------------------------------------
# Parse the markdown: for each folder-NN, capture the LAST EXERCISE: line
# (so if the first photo was "undetermined" but a later one was determined,
# we use the determined one).
# ---------------------------------------------------------------------------
exercises = {}
current_folder = None

folder_re = re.compile(r"^## folder-(\d+)$")
exercise_re = re.compile(r"^EXERCISE:\s*(.*)$")

with open(MD_FILE, "r") as fh:
    for line in fh:
        line = line.rstrip("\n")
        m = folder_re.match(line)
        if m:
            current_folder = m.group(1)
            exercises[current_folder] = ""
            continue
        m = exercise_re.match(line)
        if m and current_folder is not None:
            exercises[current_folder] = m.group(1)

# ---------------------------------------------------------------------------
# Sanitize and rename
# ---------------------------------------------------------------------------
used_names = {}
renamed = 0
skipped = 0

for i in range(1, 39):
    folder_num = f"{i:02d}"
    raw = exercises.get(folder_num, "")

    # Take text before "(" if present
    clean = raw.split("(")[0].strip()

    # Lowercase, replace non-alphanumeric with hyphens, collapse, trim
    sanitized = re.sub(r"[^a-z0-9]+", "-", clean.lower()).strip("-")

    if not sanitized or sanitized == "undetermined":
        sanitized = "undetermined"

    old_dir = os.path.join(BASE_DIR, f"folder-{folder_num}")

    if not os.path.isdir(old_dir):
        print(f"WARNING: {old_dir} does not exist, skipping.")
        skipped += 1
        continue

    # Make unique
    final_name = sanitized
    if sanitized in used_names:
        final_name = f"{sanitized}-{folder_num}"
    used_names[final_name] = True

    new_dir = os.path.join(BASE_DIR, final_name)

    if old_dir == new_dir:
        print(f"SKIP: {old_dir} already named '{final_name}'")
        continue

    if os.path.exists(new_dir):
        print(f"WARNING: {new_dir} already exists, skipping {old_dir}.")
        skipped += 1
        continue

    shutil.move(old_dir, new_dir)
    print(f"RENAMED: folder-{folder_num} -> {final_name}  (exercise: {raw})")
    renamed += 1

# ---------------------------------------------------------------------------
# Remove error/temp files from all folders
# ---------------------------------------------------------------------------
removed = 0
for root, dirs, files in os.walk(BASE_DIR):
    for fname in files:
        if fname in ("workout-metadata.md.err", "workout-metadata.md.tmp"):
            fpath = os.path.join(root, fname)
            os.remove(fpath)
            removed += 1

print()
print(f"Done. Renamed: {renamed}, Skipped: {skipped}, Error/temp files removed: {removed}")
