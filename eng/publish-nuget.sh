#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIGURATION="${CONFIGURATION:-Release}"
PACKAGE_SOURCE="${1:-$REPO_ROOT/artifacts/packages}"
NUGET_SOURCE="${2:-${NUGET_SOURCE:-https://api.nuget.org/v3/index.json}}"
REPORT_OUTPUT="${3:-${TINYRUSTLM_PUBLISH_PLAN_REPORT:-$REPO_ROOT/artifacts/reports/tinyrustlm-nuget-publish-plan.json}}"
DRY_RUN="${DRY_RUN:-0}"
SKIP_VERIFICATION="${SKIP_VERIFICATION:-0}"
PACKAGE_VERSION="${PACKAGE_VERSION:-$("$REPO_ROOT/eng/get-package-version.sh")}"
AUDIT_REPORT="${AUDIT_REPORT:-${TINYRUSTLM_PACKAGE_AUDIT_REPORT:-$REPO_ROOT/artifacts/reports/tinyrustlm-nuget-package-audit.json}}"

write_publish_plan() {
  local status="$1"
  local dry_run_value="$2"
  python3 - "$REPORT_OUTPUT" "$status" "$dry_run_value" "$PACKAGE_SOURCE" "$NUGET_SOURCE" "$PACKAGE_VERSION" "$SKIP_VERIFICATION" "$AUDIT_REPORT" "${EXPECTED_NAMES[@]}" -- "${PACKAGES[@]}" <<'PY'
import hashlib
import json
import os
import sys
from datetime import datetime, timezone

report_output, status, dry_run_raw, package_source, nuget_source, package_version, skip_verification, audit_report = sys.argv[1:9]
separator = sys.argv.index("--")
expected_names = sys.argv[9:separator]
package_paths = sys.argv[separator + 1:]
suffix = f".{package_version}.nupkg"


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


packages = []
for path in package_paths:
    name = os.path.basename(path)
    package_id = name[:-len(suffix)] if name.lower().endswith(suffix.lower()) else os.path.splitext(name)[0]
    packages.append({
        "name": name,
        "package_id": package_id,
        "path": os.path.abspath(path),
        "sha256": sha256_file(path),
        "byte_count": os.path.getsize(path),
    })


def package_audit_evidence():
    evidence = {
        "package_audit_report_path": audit_report,
        "package_audit_report_sha256": "",
        "package_audit_status": "missing",
        "package_audit_match": False,
        "package_audit_error": "",
    }
    if not os.path.isfile(audit_report):
        evidence["package_audit_error"] = f"Package audit report is required before publishing: {audit_report}"
        return evidence

    evidence["package_audit_report_path"] = os.path.abspath(audit_report)
    evidence["package_audit_report_sha256"] = sha256_file(audit_report)
    try:
        with open(audit_report, "r", encoding="utf-8-sig") as handle:
            audit = json.load(handle)
    except Exception as exc:
        evidence["package_audit_status"] = "invalid"
        evidence["package_audit_error"] = f"Package audit report is not valid JSON: {exc}"
        return evidence

    evidence["package_audit_status"] = str(audit.get("status", ""))
    if audit.get("schema") != "tinyrustlm.nuget.package_audit.v0":
        evidence["package_audit_error"] = f"Package audit report schema mismatch: {audit.get('schema', '')}"
        return evidence
    if audit.get("status") != "pass":
        evidence["package_audit_error"] = f"Package audit report status is not pass: {audit.get('status', '')}"
        return evidence

    audit_packages = {str(package.get("name", "")): package for package in audit.get("packages", [])}
    for expected_name in expected_names:
        if expected_name not in audit_packages:
            evidence["package_audit_error"] = f"Package audit report is missing expected package: {expected_name}"
            return evidence
    for package in packages:
        audit_package = audit_packages.get(package["name"])
        if audit_package is None:
            evidence["package_audit_error"] = f"Publish package was not present in audit report: {package['name']}"
            return evidence
        if str(audit_package.get("sha256", "")).lower() != package["sha256"]:
            evidence["package_audit_error"] = f"Package hash differs from audit report: {package['name']}"
            return evidence
        if int(audit_package.get("byte_count", -1)) != int(package["byte_count"]):
            evidence["package_audit_error"] = f"Package size differs from audit report: {package['name']}"
            return evidence

    evidence["package_audit_match"] = True
    return evidence


audit_evidence = package_audit_evidence()
report = {
    "schema": "tinyrustlm.nuget.publish_plan.v0",
    "generated_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "status": status,
    "package_source": os.path.abspath(package_source),
    "nuget_source": nuget_source,
    "package_version": package_version,
    "dry_run": dry_run_raw == "1",
    "skip_verification": skip_verification == "1",
    "secret_material_included": False,
    "package_audit_report_path": audit_evidence["package_audit_report_path"],
    "package_audit_report_sha256": audit_evidence["package_audit_report_sha256"],
    "package_audit_status": audit_evidence["package_audit_status"],
    "package_audit_match": audit_evidence["package_audit_match"],
    "package_audit_error": audit_evidence["package_audit_error"],
    "publish_error": os.environ.get("TINYRUSTLM_PUBLISH_ERROR", ""),
    "package_count": len(packages),
    "expected_package_names": expected_names,
    "packages": packages,
}

os.makedirs(os.path.dirname(report_output), exist_ok=True)
with open(report_output, "w", encoding="utf-8") as handle:
    json.dump(report, handle, indent=2)
    handle.write("\n")
print(f"TinyRustLM NuGet publish plan written to {report_output}")
PY
}

validate_package_audit_binding() {
  python3 - "$AUDIT_REPORT" "${EXPECTED_NAMES[@]}" -- "${PACKAGES[@]}" <<'PY'
import hashlib
import json
import os
import sys

audit_report = sys.argv[1]
separator = sys.argv.index("--")
expected_names = sys.argv[2:separator]
package_paths = sys.argv[separator + 1:]


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


if not os.path.isfile(audit_report):
    raise SystemExit(f"Package audit report is required before publishing: {audit_report}")

with open(audit_report, "r", encoding="utf-8-sig") as handle:
    audit = json.load(handle)
if audit.get("schema") != "tinyrustlm.nuget.package_audit.v0":
    raise SystemExit(f"Package audit report schema mismatch: {audit.get('schema', '')}")
if audit.get("status") != "pass":
    raise SystemExit(f"Package audit report status is not pass: {audit.get('status', '')}")

audit_packages = {str(package.get("name", "")): package for package in audit.get("packages", [])}
for expected_name in expected_names:
    if expected_name not in audit_packages:
        raise SystemExit(f"Package audit report is missing expected package: {expected_name}")

for path in package_paths:
    name = os.path.basename(path)
    audit_package = audit_packages.get(name)
    if audit_package is None:
        raise SystemExit(f"Publish package was not present in audit report: {name}")
    if str(audit_package.get("sha256", "")).lower() != sha256_file(path):
        raise SystemExit(f"Package hash differs from audit report: {name}")
    if int(audit_package.get("byte_count", -1)) != os.path.getsize(path):
        raise SystemExit(f"Package size differs from audit report: {name}")
PY
}

if [[ "$SKIP_VERIFICATION" != "1" ]]; then
  "$REPO_ROOT/eng/verify-package.sh" "$CONFIGURATION"
fi

if [[ ! -d "$PACKAGE_SOURCE" ]]; then
  echo "Package source does not exist: $PACKAGE_SOURCE" >&2
  exit 1
fi
PACKAGE_SOURCE="$(cd "$PACKAGE_SOURCE" && pwd)"

mapfile -t PACKAGES < <(find "$PACKAGE_SOURCE" -maxdepth 1 -type f -name 'TinyRustLM*.nupkg' | sort)
if [[ "${#PACKAGES[@]}" -eq 0 ]]; then
  echo "No TinyRustLM packages were found in $PACKAGE_SOURCE" >&2
  exit 1
fi

EXPECTED_NAMES=(
  "TinyRustLM.Abstractions.${PACKAGE_VERSION}.nupkg"
  "TinyRustLM.Core.${PACKAGE_VERSION}.nupkg"
  "TinyRustLM.P2P.${PACKAGE_VERSION}.nupkg"
)

contains_expected_package() {
  local candidate="$1"
  local expected
  for expected in "${EXPECTED_NAMES[@]}"; do
    if [[ "$expected" == "$candidate" ]]; then
      return 0
    fi
  done
  return 1
}

for expected_name in "${EXPECTED_NAMES[@]}"; do
  if ! printf '%s\n' "${PACKAGES[@]##*/}" | grep -Fxq "$expected_name"; then
    echo "Required package is missing from publish set: $expected_name" >&2
    exit 1
  fi
done

UNEXPECTED_NAMES=()
for package in "${PACKAGES[@]}"; do
  package_name="${package##*/}"
  if ! contains_expected_package "$package_name"; then
    UNEXPECTED_NAMES+=("$package_name")
  fi
done
if [[ "${#UNEXPECTED_NAMES[@]}" -gt 0 ]]; then
  echo "Publish set contains unexpected package(s): ${UNEXPECTED_NAMES[*]}. Expected exactly: ${EXPECTED_NAMES[*]}" >&2
  exit 1
fi

if ! audit_error="$(validate_package_audit_binding 2>&1)"; then
  if [[ -f "$AUDIT_REPORT" ]]; then
    write_publish_plan "blocked_audit_mismatch" "$DRY_RUN"
  else
    write_publish_plan "blocked_missing_audit_report" "$DRY_RUN"
  fi
  printf '%s\n' "$audit_error" >&2
  exit 1
fi

echo "TinyRustLM NuGet publish set:"
printf ' - %s\n' "${PACKAGES[@]##*/}"
echo "NuGet source: $NUGET_SOURCE"
echo "Package version: $PACKAGE_VERSION"

if [[ "$DRY_RUN" == "1" ]]; then
  write_publish_plan "dry_run" "1"
  echo "Dry run requested; packages were not pushed."
  exit 0
fi
if [[ -z "${NUGET_API_KEY:-}" ]]; then
  write_publish_plan "blocked_missing_api_key" "0"
  echo "NUGET_API_KEY is required unless DRY_RUN=1 is used." >&2
  exit 1
fi

write_publish_plan "ready_to_push" "0"
for package in "${PACKAGES[@]}"; do
  if ! push_output="$(dotnet nuget push "$package" \
    --source "$NUGET_SOURCE" \
    --api-key "$NUGET_API_KEY" \
    --skip-duplicate 2>&1)"; then
    push_output="${push_output//$NUGET_API_KEY/<redacted>}"
    TINYRUSTLM_PUBLISH_ERROR="$push_output" write_publish_plan "push_failed" "0"
    printf '%s\n' "$push_output" >&2
    exit 1
  fi
  printf '%s\n' "$push_output"
done
write_publish_plan "pushed" "0"
