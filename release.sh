#!/bin/bash
set -e

LEVEL=${1:-patch}

case "$LEVEL" in
  patch|minor|major) ;;
  *)
    echo "Usage: ./release.sh [patch|minor|major]"
    exit 1
    ;;
esac

if ! git diff --quiet; then
  echo "Working tree has uncommitted changes. Please commit first."
  exit 1
fi

npm version "$LEVEL"
git push
git push --tags

echo "Release done. Create a GitHub Release from the new tag."
