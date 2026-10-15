#!/usr/bin/env python3
"""Build and validate a source-inclusive Hostinger ZIP without altering workspace dist."""

import argparse
import hashlib
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import zipfile


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = "punyakart-hostinger-campaign-routes-v14.zip"
ROOT_FILES = {
    "server.ts", "server.cjs", "package.json", "package-lock.json",
    "tsconfig.json", "vite.config.ts", ".npmrc", "README.md",
    "DEPLOYMENT.md", "META_CAPI.md", "TRAFFIC_ATTRIBUTION.md", "SECURITY.md", "LICENSE",
}
SCRIPTS = {"scripts/pack-hostinger.sh", "scripts/pack_hostinger.py", "scripts/migrate-payment-attempts.ts"}
ASSETS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".ico",
    ".woff", ".woff2", ".ttf", ".otf", ".mp4", ".webm", ".mp3", ".ogg",
    ".webmanifest", ".xml",
}
FRONTEND = ASSETS | {".ts", ".tsx", ".js", ".jsx", ".css", ".html", ".json"}
BUILT = ASSETS | {".js", ".css", ".html", ".json"}
BANNED_DIRS = {"node_modules", "__pycache__", "coverage", "logs"}
BANNED_SUFFIXES = {
    ".map", ".log", ".zip", ".gz", ".tgz", ".tar", ".7z", ".rar",
    ".pem", ".key", ".crt", ".cer", ".p12", ".pfx", ".der", ".jks",
    ".db", ".sqlite", ".sqlite3", ".bak", ".sql",
}
PRIVATE_NAME = re.compile(
    r"credential|secret|password|private[-_ ]?key|service[-_ ]?account|"
    r"(^|[._ -])(env|private|backup|dump|id_rsa|id_ed25519)([._ -]|$)",
    re.IGNORECASE,
)
GATEWAYS = (
    "https://md-eecad2978f7a43f5b7838c919258e6de.ecs.us-east-2.on.aws",
    "https://bded8a3c6ae-1-1053047382554.us-central1.run.app",
    "https://mpc-prod-28-1053047382554.us-central1.run.app",
    "https://mpc-prod-21-1053047382554.us-central1.run.app",
    "https://5z-2b6b7616f94640c2840d1841e1ac24c3.ecs.us-east-1.on.aws",
)
PIXELS = ("922745934005234", "1112592431188643")


class PackError(Exception):
    """Safe, fixed diagnostic that never includes file contents or private paths."""


def require(condition, message):
    if not condition:
        raise PackError(message)


def check_parts(name):
    path = PurePosixPath(name)
    require(
        bool(name) and not path.is_absolute() and path.as_posix() == name
        and "\\" not in name and ":" not in name
        and all(part not in {".", "..", ""} for part in path.parts),
        "Rejected a non-relative or non-portable archive path.",
    )
    for part in path.parts:
        if name == ".npmrc":
            continue
        require(
            not part.startswith(".") and part.lower() not in BANNED_DIRS
            and (not PRIVATE_NAME.search(part)
                 or (name == "frontend/src/vite-env.d.ts" and part == "vite-env.d.ts"))
            and not ({suffix.lower() for suffix in PurePosixPath(part).suffixes}
                     & BANNED_SUFFIXES)
            and not any(ord(char) < 32 for char in part),
            "Rejected a hidden, private, or forbidden entry; its name is suppressed.",
        )


def check_file_name(name):
    check_parts(name)
    path = PurePosixPath(name)
    if name in ROOT_FILES or name in SCRIPTS:
        return
    top = path.parts[0]
    suffix = path.suffix.lower()
    allowed = False
    if top in {"backend", "tests"}:
        allowed = suffix == ".ts"
    elif top == "frontend":
        allowed = suffix in FRONTEND or path.name == "robots.txt"
    elif top == "dist":
        allowed = (suffix in BUILT or path.name == "robots.txt"
                   or name in {"dist/server.cjs", "dist/migrate.cjs"})
    require(allowed, "Rejected an unexpected file outside the source/asset allowlist.")


def checked_stat(path):
    info = path.lstat()
    require(
        not stat.S_ISLNK(info.st_mode)
        and not (getattr(info, "st_file_attributes", 0)
                 & (getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
                    | getattr(stat, "FILE_ATTRIBUTE_HIDDEN", 0x2)
                    | getattr(stat, "FILE_ATTRIBUTE_SYSTEM", 0x4))),
        "Rejected a symlink, hidden/system entry, or filesystem reparse point.",
    )
    require(stat.S_ISDIR(info.st_mode) or stat.S_ISREG(info.st_mode),
            "Rejected a non-regular filesystem entry.")
    return info


def signature(info):
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns)


def scan_tree(base, relative):
    """Check directory names and lstat BEFORE descent; never follow links."""
    found = {}
    directory = base / relative
    require(stat.S_ISDIR(checked_stat(directory).st_mode), "Missing source directory.")
    for child in sorted(directory.iterdir()):
        name = child.relative_to(base).as_posix()
        check_parts(name)
        info = checked_stat(child)
        if stat.S_ISDIR(info.st_mode):
            found.update(scan_tree(base, name))
        else:
            check_file_name(name)
            found[name] = signature(info)
    return found


def source_manifest():
    found = {}
    for name in sorted(ROOT_FILES | SCRIPTS):
        # Check the selected scripts directory too, rather than following a junction.
        if name in SCRIPTS:
            checked_stat(ROOT / "scripts")
        check_file_name(name)
        info = checked_stat(ROOT / name)
        require(stat.S_ISREG(info.st_mode), "Missing required regular source file.")
        found[name] = signature(info)
    for directory in ("backend", "frontend", "tests"):
        found.update(scan_tree(ROOT, directory))
    require((ROOT / ".npmrc").read_bytes().strip() == b"production=false",
            "The allowed .npmrc must contain only production=false.")
    return found


def run_node(node, label, *args):
    print(f"Checking/building: {label}", flush=True)
    # Build diagnostics can contain source text or environment values. Do not echo them.
    result = subprocess.run(
        [node, *map(str, args)], cwd=ROOT,
        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        check=False,
    )
    require(result.returncode == 0,
            f"{label} failed (exit {result.returncode}); diagnostics suppressed for privacy.")


def validate_archive(archive, expected):
    with zipfile.ZipFile(archive) as packed:
        entries = packed.infolist()
        names = [entry.filename for entry in entries]
        require(len(names) == len(set(name.casefold() for name in names)),
                "Archive contains duplicate or case-colliding names.")
        require(set(names) == expected, "Archive does not match the checked manifest.")
        required = ROOT_FILES | SCRIPTS | {
            "frontend/index.html", "frontend/src/main.tsx", "backend/db/migrate.ts",
            "backend/contentSecurityPolicy.ts", "tests/contentSecurityPolicy.test.ts",
            "tests/donationAmounts.test.ts", "frontend/src/constants/donation.ts",
            "backend/validation/donationAmountSchema.ts", "tests/backendDonationMinimum.test.ts",
            "backend/campaignAttribution.ts", "backend/publicAssetPolicy.ts",
            "frontend/src/utils/publicDonations.ts", "frontend/src/utils/paymentSession.ts",
            "frontend/src/hooks/usePublicCampaign.ts", "frontend/src/admin/adminCmsSync.ts",
            "frontend/src/utils/campaignRoutes.ts", "frontend/src/components/RouteErrorBoundary.tsx",
            "tests/campaignRoutes.test.ts", "tests/campaignRouteLoading.test.ts",
            "tests/securityBoundary.test.ts",
            "backend/metaConversions.ts", "backend/metaPaymentTracking.ts", "backend/ipAddress.ts",
            "backend/db/MongoMetaConversionRepository.ts", "frontend/src/utils/metaTracking.ts",
            "backend/db/PaymentAttemptRepository.ts", "backend/db/MongoPaymentAttemptRepository.ts",
            "tests/paymentAttemptFlow.test.ts", "scripts/migrate-payment-attempts.ts",
            "frontend/src/utils/donationSource.ts", "frontend/src/utils/donationCurrency.ts",
            "backend/adminDonation.ts", "backend/trafficAttribution.ts",
            "frontend/src/utils/trafficAttribution.ts", "frontend/src/utils/trafficAttributionSession.ts",
            "frontend/src/admin/donorTraffic.ts",
            "tests/trafficAttribution.test.ts", "tests/adminTraffic.test.ts", "tests/trafficFlow.test.ts",
            "frontend/src/data/navratriCampaign.ts", "frontend/src/pages/TuesdayCampaignPage.tsx",
            "frontend/public/navratri-hero.jpg", "dist/navratri-hero.jpg", "tests/navratriPage.test.ts",
            "tests/navratriDiscovery.test.ts", "tests/navratriIntegration.test.ts",
            "tests/metaConversions.test.ts", "tests/metaTracking.test.ts", "tests/metaPaymentFlow.test.ts",
            "frontend/src/pages/LegacyCrowdFundingPage.tsx",
            "frontend/src/components/campaign/CauseContributionSection.tsx",
            "frontend/src/pages/TuesdayCampaignPage.tsx",
            "frontend/src/utils/campaignQuantity.ts", "tests/campaignQuantity.test.ts",
            "dist/index.html", "dist/server.cjs", "dist/migrate.cjs",
        }
        require(required <= set(names), "Archive is missing required app/build files.")
        require(any(name.startswith("dist/assets/") for name in names),
                "Archive is missing frontend bundles.")
        for entry in entries:
            check_file_name(entry.filename)
            require(not entry.is_dir() and not stat.S_ISLNK(entry.external_attr >> 16)
                    and entry.compress_type == zipfile.ZIP_DEFLATED,
                    "Archive contains an invalid entry type or compression method.")
        require(packed.testzip() is None, "Archive CRC verification failed.")
        server = packed.read("dist/server.cjs").decode("utf-8")
        require(re.search(r"\bMIN_DONATION_AMOUNT\s*=\s*200\b", server) is not None,
                "Built server is missing the uniform INR 200 minimum.")
        require("export const MIN_DONATION_AMOUNT = 200;" in
                packed.read("frontend/src/constants/donation.ts").decode("utf-8"),
                "Shared source is missing the uniform INR 200 minimum.")
        require(all(origin in server for origin in GATEWAYS),
                 "Built server is missing an exact CSP gateway origin.")
        require(all(marker in server for marker in (
            "META_CAPI_ACCESS_TOKEN", "META_CAPI_TEST_EVENT_CODE", "meta_conversion_outbox",
            "/api/admin/meta-capi/status", "metaCapiConfigured", "1112592431188643",
        )), "Built server is missing required CAPI integration markers.")
        require("frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://www.googletagmanager.com https://www.facebook.com" in server,
                "Built server is missing the exact observed Facebook frame source.")
        require("https://*.facebook.com" not in server,
                "Built server must not permit a broad Facebook frame wildcard.")
        require(all(marker in server for marker in (
            "trafficAttribution", "sanitizeTrafficAttribution", "storedTrafficAttribution",
            "resolveRecordedDonationSource", "toAdminDonation",
        )), "Built server is missing traffic capture/admin serialization wiring.")
        require("navratri" in server, "Built server is missing the Navratri campaign seed wiring.")
        for name in names:
            if name.startswith("dist/assets/") and name.endswith(".js"):
                require("META_CAPI_ACCESS_TOKEN" not in packed.read(name).decode("utf-8"),
                        "Server-only CAPI configuration must not appear in a frontend bundle.")
        # Match each quoted directive, respecting its quote delimiter and JS escapes.
        script_directives = list(re.finditer(
            r"""(?P<quote>['"])(?P<directive>script-src(?:-elem)?)\s+"""
            r"""(?P<sources>(?:\\.|(?!(?P=quote))[^\\\r\n])*)(?P=quote)""",
            server,
        ))
        for directive in ("script-src", "script-src-elem"):
            sources = [match.group("sources").split() for match in script_directives
                       if match.group("directive") == directive]
            require(bool(sources) and all(
                "https://www.facebook.com/signals/iwl.js" in values for values in sources
            ), f"Built server {directive} is missing the exact Meta IWL script source.")
            for exact_script in (
                "https://scripts.clarity.ms",
                "https://cdn.jsdelivr.net/npm/meta-capi-param-builder-clientjs/dist/clientParamBuilder.bundle.js",
                "https://unpkg.com/meta-capi-param-builder-clientjs/dist/clientParamBuilder.bundle.js",
            ):
                require(all(exact_script in values for values in sources),
                        f"Built server {directive} is missing a required exact telemetry script source.")
        html = packed.read("dist/index.html").decode("utf-8")
        for pixel in PIXELS:
            require(re.search(r"fbq\(\s*['\"]init['\"]\s*,\s*['\"]" + pixel
                              + r"['\"]\s*\)", html) is not None,
                    "Built HTML is missing an existing Pixel initialization.")
        require(len(re.findall(r"fbq\(\s*['\"]track['\"]\s*,\s*['\"]PageView['\"]\s*\)",
                               html)) == 1,
                "Built HTML must retain one shared Pixel PageView call.")
        return len(entries), sum(entry.file_size for entry in entries)


def existing_parent(path, label):
    require(path.parent.is_dir(), f"{label} parent directory must already exist.")
    # Resolve only the parent so an existing output symlink cannot hide a collision.
    return path.parent.resolve() / path.name


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path(DEFAULT_OUTPUT),
                        help="ZIP path (relative paths are based on the project root)")
    parser.add_argument("--temp-dir", type=Path,
                        help="existing staging parent on the same filesystem as output")
    parser.add_argument("--no-listen-tests", action="store_true",
                        help="skip the CSP HTTP-listener fixture; retain all other isolated checks")
    args = parser.parse_args()
    output = args.output if args.output.is_absolute() else ROOT / args.output
    output = existing_parent(output, "Output")
    require(output.parent == ROOT or not output.parent.is_relative_to(ROOT),
            "Output must be in the project root or outside the project source/build trees.")
    require(output.suffix.lower() == ".zip", "Output must have a .zip extension.")
    require(not os.path.lexists(output), "Output already exists; refusing to overwrite it.")
    temp_parent = args.temp_dir or Path(tempfile.gettempdir())
    if not temp_parent.is_absolute():
        temp_parent = ROOT / temp_parent
    require(temp_parent.is_dir(), "Temporary parent directory must already exist.")
    temp_parent = temp_parent.resolve()
    require(not temp_parent.is_relative_to(ROOT),
            "Temporary staging must be outside the project source/build trees.")
    require(temp_parent.stat().st_dev == output.parent.stat().st_dev,
            "Temporary and output parents must be on the same filesystem for atomic publication.")
    node = shutil.which("node")
    require(node is not None, "Node.js must be available on PATH.")
    clis = {
        "tsc": ROOT / "node_modules/typescript/bin/tsc",
        "tsx": ROOT / "node_modules/tsx/dist/cli.mjs",
        "vite": ROOT / "node_modules/vite/bin/vite.js",
        "esbuild": ROOT / "node_modules/esbuild/bin/esbuild",
    }
    require(all(path.is_file() for path in clis.values()),
            "Local build tools are missing; install package-lock dependencies first.")
    sources = source_manifest()  # In particular, inspect public BEFORE Vite can copy it.
    print("Skipped test:backend: it can delete database data and send notifications.")
    with tempfile.TemporaryDirectory(prefix="punyakart-pack-", dir=temp_parent) as temporary:
        stage = Path(temporary)
        dist = stage / "dist"
        run_node(node, "TypeScript", clis["tsc"], "--noEmit")
        csp_options = ["--test-name-pattern=^(?!Express can emit)"] if args.no_listen_tests else []
        if args.no_listen_tests:
            print("Skipped CSP HTTP-listener fixture; no local server will be started.")
        run_node(node, "isolated CSP tests", clis["tsx"], "--test", *csp_options,
                  "tests/contentSecurityPolicy.test.ts")
        run_node(node, "isolated payment attempt and reconciliation tests", clis["tsx"], "--test",
                 "tests/paymentAttemptFlow.test.ts")
        run_node(node, "isolated donation amount tests", clis["tsx"], "--test",
                 "tests/donationAmounts.test.ts")
        run_node(node, "isolated Meta CAPI, consent and payment-flow tests", clis["tsx"], "--test",
                 "tests/metaConversions.test.ts", "tests/metaTracking.test.ts", "tests/metaPaymentFlow.test.ts")
        run_node(node, "isolated traffic capture, admin and persistence-flow tests", clis["tsx"], "--test",
                 "tests/trafficAttribution.test.ts", "tests/adminTraffic.test.ts", "tests/trafficFlow.test.ts")
        run_node(node, "isolated Navratri page, discovery and integration tests", clis["tsx"], "--test",
                  "tests/navratriPage.test.ts", "tests/navratriDiscovery.test.ts", "tests/navratriIntegration.test.ts")
        run_node(node, "isolated full-stack repair, minimum and mobile regressions", clis["tsx"], "--test",
                  "tests/adminCmsSync.test.ts", "tests/backendCampaignFlow.test.ts",
                  "tests/backendDonationMinimum.test.ts", "tests/campaignImages.test.ts",
                  "tests/contributionTiers.test.ts", "tests/donationReadbackContract.test.ts",
                  "tests/genericCampaignRendering.test.ts", "tests/liveDonationToast.test.ts",
                  "tests/mobileLayout.test.ts", "tests/paymentSession.test.ts",
                  "tests/publicAssetPolicy.test.ts", "tests/publicCampaignPolling.test.ts",
                  "tests/publicCampaignRendering.test.ts", "tests/publicDonations.test.ts",
                  "tests/siteChrome.test.ts", "tests/campaignRoutes.test.ts",
                  "tests/campaignRouteLoading.test.ts", "tests/releaseHardening.test.ts",
                  "tests/securityBoundary.test.ts")
        require(source_manifest() == sources, "Sources changed during checks; rerun packaging.")
        run_node(node, "Vite frontend", clis["vite"], "build", "--outDir", dist,
                 "--emptyOutDir", "false")
        for source, target in (("server.ts", "server.cjs"),
                               ("backend/db/migrate.ts", "migrate.cjs")):
            run_node(node, f"esbuild {target}", clis["esbuild"], source, "--bundle",
                     "--platform=node", "--format=cjs", "--packages=external",
                     f"--outfile={dist / target}")
            run_node(node, f"Node syntax {target}", "--check", dist / target)
        require(source_manifest() == sources, "Sources changed during build; rerun packaging.")
        generated = scan_tree(stage, "dist")
        archive = stage / "ready.zip"
        with zipfile.ZipFile(archive, "x", compression=zipfile.ZIP_DEFLATED,
                             compresslevel=6) as packed:
            for base, manifest in ((ROOT, sources), (stage, generated)):
                for name, original in sorted(manifest.items()):
                    path = base / name
                    require(signature(checked_stat(path)) == original,
                            "A selected file changed during packaging; rerun packaging.")
                    packed.write(path, arcname=name)
                    require(signature(checked_stat(path)) == original,
                            "A selected file changed while being archived; rerun packaging.")
        count, unpacked_bytes = validate_archive(archive, set(sources) | set(generated))
        with archive.open("rb") as handle:
            digest = hashlib.file_digest(handle, "sha256").hexdigest()
        zip_bytes = archive.stat().st_size
        # Hard-link publication is atomic and cannot replace an existing destination,
        # unlike POSIX rename. Removing the staging link completes the move.
        try:
            os.link(archive, output)
        except FileExistsError:
            raise PackError("Output appeared during packaging; refusing to overwrite it.") from None
        archive.unlink()
    print(f"Ready: {count} files; {unpacked_bytes} unpacked bytes; {zip_bytes} ZIP bytes.")
    print(f"SHA256: {digest}")
    print("Verified: ZIP CRC, allowlist, required files, CSP hosts, both Pixels, CAPI/traffic/Navratri wiring, Node syntax.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except PackError as error:
        print(f"Packaging stopped: {error}", file=sys.stderr)
        sys.exit(1)
    except (OSError, ValueError, zipfile.BadZipFile, UnicodeError):
        print("Packaging stopped: filesystem/archive operation failed; private details suppressed.",
              file=sys.stderr)
        sys.exit(1)
