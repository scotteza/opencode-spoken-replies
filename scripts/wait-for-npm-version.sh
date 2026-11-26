#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
project_dir=$(dirname "$script_dir")
local_version=$(node -p "require(process.argv[1]).version" "$project_dir/package.json")

printf 'Waiting for npm version %s...\n' "$local_version"

while :; do
  if npm_version=$("$script_dir/get-npm-version.sh"); then
    if [ "$npm_version" = "$local_version" ]; then
      printf 'npm version %s is available.\n' "$local_version"
      if command -v afplay >/dev/null 2>&1 && [ -f /System/Library/Sounds/Glass.aiff ]; then
        afplay /System/Library/Sounds/Glass.aiff || printf '\a'
      else
        printf '\a'
      fi
      exit 0
    fi
    printf 'Current npm version: %s\n' "$npm_version"
  else
    printf 'Could not get the npm version; retrying.\n' >&2
  fi
  sleep 2
done
