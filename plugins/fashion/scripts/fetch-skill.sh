#!/usr/bin/env bash
# Usage: fetch-skill.sh <repo-url> <sha> <path-in-repo> <dest-dir>
# Fetches one folder of a git repo at a pinned commit into <dest-dir>. Writes nothing else.
set -euo pipefail
repo="$1"; sha="$2"; path="$3"; dest="$4"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
git -C "$tmp" init -q
git -C "$tmp" fetch -q --depth 1 "$repo" "$sha"
git -C "$tmp" checkout -q FETCH_HEAD
[ -f "$tmp/$path/SKILL.md" ] || { echo "no SKILL.md at $path" >&2; exit 1; }
mkdir -p "$dest"
cp -R "$tmp/$path/." "$dest/"
