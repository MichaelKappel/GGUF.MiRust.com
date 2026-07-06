#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NUGET_SOURCE="${1:-${NUGET_SOURCE:-https://api.nuget.org/v3/index.json}}"
PUBLISH_PLAN_REPORT="${2:-${TINYRUSTLM_PUBLISH_PLAN_REPORT:-$REPO_ROOT/artifacts/reports/tinyrustlm-nuget-publish-plan.json}}"
REPORT_OUTPUT="${3:-${TINYRUSTLM_FEED_HASH_REPORT:-$REPO_ROOT/artifacts/reports/tinyrustlm-nuget-feed-hashes.json}}"

python3 - "$NUGET_SOURCE" "$PUBLISH_PLAN_REPORT" "$REPORT_OUTPUT" <<'PY'
import hashlib
import json
import os
import sys
import tempfile
import urllib.request
from datetime import datetime, timezone

source, publish_plan_report, report_output = sys.argv[1:4]


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json_file(path):
    with open(path, "r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def read_json_url(url):
    request = urllib.request.Request(url, headers={"User-Agent": "TinyRustLM-NuGet-Hash/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def flat_container_base_url(index_url):
    index = read_json_url(index_url)
    for resource in index.get("resources", []):
        resource_type = resource.get("@type", "")
        resource_types = resource_type if isinstance(resource_type, list) else [resource_type]
        if any("PackageBaseAddress/3.0.0" in str(item) for item in resource_types):
            base = resource.get("@id", "")
            return base if base.endswith("/") else f"{base}/"
    raise RuntimeError(f"NuGet source does not expose PackageBaseAddress/3.0.0: {index_url}")


def remote_package_url(base_url, package_id, package_version):
    lower_id = package_id.lower()
    lower_version = package_version.lower()
    return f"{base_url}{lower_id}/{lower_version}/{lower_id}.{lower_version}.nupkg"


def download_file(url, path):
    request = urllib.request.Request(url, headers={"User-Agent": "TinyRustLM-NuGet-Hash/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response, open(path, "wb") as handle:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            handle.write(chunk)


if not os.path.isfile(publish_plan_report):
    raise SystemExit(f"Publish plan report does not exist: {publish_plan_report}")

publish_plan_report = os.path.abspath(publish_plan_report)
publish_plan = read_json_file(publish_plan_report)
if publish_plan.get("schema") != "tinyrustlm.nuget.publish_plan.v0":
    raise SystemExit(f"Publish plan report schema mismatch: {publish_plan.get('schema', '')}")
if not publish_plan.get("package_audit_match"):
    raise SystemExit(f"Publish plan report is not bound to a passing package audit: {publish_plan_report}")

source_kind = "folder" if os.path.isdir(source) else "nuget-v3"
resolved_source = os.path.abspath(source) if source_kind == "folder" else source
base_url = "" if source_kind == "folder" else flat_container_base_url(source)
package_version = str(publish_plan.get("package_version", ""))

package_reports = []
with tempfile.TemporaryDirectory(prefix="tinyrustlm-feed-hashes-") as temp_root:
    for package in publish_plan.get("packages", []):
        name = str(package.get("name", ""))
        package_id = str(package.get("package_id", ""))
        expected_sha256 = str(package.get("sha256", "")).lower()
        expected_byte_count = int(package.get("byte_count", -1))
        feed_location = ""
        source_path = ""
        present = False
        actual_sha256 = ""
        actual_byte_count = 0
        error_message = ""
        try:
            if source_kind == "folder":
                source_path = os.path.join(resolved_source, name)
                feed_location = source_path
                if not os.path.isfile(source_path):
                    raise FileNotFoundError(f"Package file does not exist in feed folder: {source_path}")
            else:
                feed_location = remote_package_url(base_url, package_id, package_version)
                source_path = os.path.join(temp_root, name)
                download_file(feed_location, source_path)

            present = True
            actual_sha256 = sha256_file(source_path)
            actual_byte_count = os.path.getsize(source_path)
        except Exception as exc:
            error_message = str(exc)

        package_reports.append({
            "package_id": package_id,
            "name": name,
            "feed_location": feed_location or source_path,
            "present": present,
            "expected_sha256": expected_sha256,
            "actual_sha256": actual_sha256,
            "sha256_match": present and actual_sha256 == expected_sha256,
            "expected_byte_count": expected_byte_count,
            "actual_byte_count": actual_byte_count,
            "byte_count_match": present and actual_byte_count == expected_byte_count,
            "error_message": error_message,
        })

missing_packages = [package for package in package_reports if not package["present"]]
hash_mismatches = [package for package in package_reports if package["present"] and not package["sha256_match"]]
byte_count_mismatches = [package for package in package_reports if package["present"] and not package["byte_count_match"]]
status = "pass" if not missing_packages and not hash_mismatches and not byte_count_mismatches else "fail"
report = {
    "schema": "tinyrustlm.nuget.feed_hashes.v0",
    "generated_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "status": status,
    "source": resolved_source,
    "source_kind": source_kind,
    "package_version": package_version,
    "publish_plan_report_path": publish_plan_report,
    "publish_plan_report_sha256": sha256_file(publish_plan_report),
    "package_audit_report_sha256": str(publish_plan.get("package_audit_report_sha256", "")),
    "secret_material_included": False,
    "package_count": len(package_reports),
    "missing_package_count": len(missing_packages),
    "hash_mismatch_count": len(hash_mismatches),
    "byte_count_mismatch_count": len(byte_count_mismatches),
    "packages": package_reports,
}

os.makedirs(os.path.dirname(report_output), exist_ok=True)
with open(report_output, "w", encoding="utf-8") as handle:
    json.dump(report, handle, indent=2)
    handle.write("\n")

print(f"TinyRustLM NuGet feed-hashes report written to {report_output}")
if status != "pass":
    raise SystemExit(f"TinyRustLM NuGet feed hash verification failed. See {report_output}")
print(f"TinyRustLM NuGet feed package hashes match publish plan: {resolved_source}")
PY
