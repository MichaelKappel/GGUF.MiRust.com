#!/usr/bin/env bash
set -euo pipefail

CONFIGURATION="${1:-Release}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_OUTPUT="${2:-$REPO_ROOT/artifacts/packages}"

"$REPO_ROOT/eng/build-native.sh" release
mkdir -p "$PACKAGE_OUTPUT"
find "$PACKAGE_OUTPUT" -maxdepth 1 -type f -name 'TinyRustLM*.nupkg' -delete
cd "$REPO_ROOT"
dotnet restore dotnet/TinyRustLM.sln
dotnet build dotnet/TinyRustLM.sln -c "$CONFIGURATION" --no-restore
TINYRUSTLM_REPO_ROOT="$REPO_ROOT" TINYRUSTLM_PACKAGE_DIR="$PACKAGE_OUTPUT" dotnet test dotnet/TinyRustLM.sln -c "$CONFIGURATION" --no-build
dotnet pack dotnet/src/TinyRustLM.Abstractions/TinyRustLM.Abstractions.csproj -c "$CONFIGURATION" --no-build -o "$PACKAGE_OUTPUT"
dotnet pack dotnet/src/TinyRustLM.Core/TinyRustLM.Core.csproj -c "$CONFIGURATION" --no-build -o "$PACKAGE_OUTPUT"
dotnet pack dotnet/src/TinyRustLM.P2P/TinyRustLM.P2P.csproj -c "$CONFIGURATION" --no-build -o "$PACKAGE_OUTPUT"
echo "TinyRustLM packages written to $PACKAGE_OUTPUT"
