#!/bin/sh
# Build the site exactly as GitHub Pages does (same Jekyll image as its deploy action).
# Usage: scripts/build-site.sh [output-dir]   (default: _site)
set -e

cd "$(dirname "$0")/.."
out="$(mkdir -p "${1:-_site}" && cd "${1:-_site}" && pwd)"

docker run --rm --platform linux/amd64 \
  -v "$PWD":/github/workspace/src:ro \
  -v "$out":/github/workspace/_site \
  -e GITHUB_WORKSPACE=/github/workspace \
  -e GITHUB_REPOSITORY=dungnguyenv/happybooth \
  -e INPUT_SOURCE=src -e INPUT_DESTINATION=_site \
  -e INPUT_VERBOSE=false -e INPUT_FUTURE=false -e INPUT_BUILD_REVISION=local \
  -e NO_NETWORK=true \
  ghcr.io/actions/jekyll-build-pages:v1.0.13

echo "Built into $out"
