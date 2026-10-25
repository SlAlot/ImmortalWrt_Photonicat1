#!/usr/bin/env python3
"""Retain iStore's Lua API and adapt the pinned Docker manager for a router."""
import hashlib
import json
from pathlib import Path
import re
import sys

REPO = Path(__file__).resolve().parents[1]
MENU = "applications/luci-app-dockerman/root/usr/share/luci/menu.d/luci-app-dockerman.json"
COMMON = "applications/luci-app-dockerman/htdocs/luci-static/resources/dockerman/common.js"
DAEMON = "utils/dockerd/files/dockerd.init"
RPC = "applications/luci-app-dockerman/root/usr/share/rpcd/ucode/docker_rpc.uc"
CONTROLLER = "applications/luci-app-dockerman/ucode/controller/docker.uc"
OLD = "admin/services/dockerman"
NEW = "admin/docker"


def integration_revision():
    inputs = [Path(__file__), REPO / "scripts/docker-source-hashes.json",
              *(REPO / f"patches/luci/docker-logs-{n}.patch" for n in (8976, 8977))]
    inputs.append(REPO / "patches/luci/docker-http-helpers.uc")
    return hashlib.sha256(b"".join(path.read_bytes() for path in inputs)).hexdigest()


def apply_hunks(text, patch):
    """Use exact complete hunk contexts, never offsets or fuzzy matching."""
    chunks = re.split(r"^@@[^\n]*\n", patch, flags=re.M)[1:]
    if not chunks:
        raise ValueError("No unified patch hunks")
    for chunk in chunks:
        old, new = [], []
        for line in chunk.splitlines(keepends=True):
            if line.startswith((" ", "-")):
                old.append(line[1:])
            if line.startswith((" ", "+")):
                new.append(line[1:])
        before, after = "".join(old), "".join(new)
        if not before or text.count(before) != 1:
            raise ValueError("Docker log patch context changed")
        text = text.replace(before, after, 1)
    return text


def transform_menu(text):
    menu = json.loads(text)
    result = {}
    for path, entry in menu.items():
        if not (path == OLD or path.startswith(OLD + "/")):
            raise ValueError("Unexpected Docker menu route")
        canonical = json.loads(json.dumps(entry).replace(OLD, NEW))
        if path == OLD:
            canonical.update(title="Docker", order=40)
        result[path.replace(OLD, NEW, 1)] = canonical
        # Saved iStore links and old direct API URLs remain callable, with
        # their authentication/POST/ACL checks. They have no sidebar titles.
        legacy = dict(entry)
        legacy.pop("title", None)
        legacy.pop("title_hide", None)
        if path == OLD:
            legacy["action"] = {"type": "alias", "path": NEW}
        result[path] = legacy
    return json.dumps(result, ensure_ascii=False, indent=2) + "\n"


def patch_docker(root):
    root = Path(root)
    luci = root / "feeds/luci"
    packages = root / "feeds/packages"
    files = {luci / MENU: transform_menu, luci / COMMON: lambda text: text.replace(
        "L.url('admin/services/dockerman')", "L.url('admin/docker')"),
        packages / DAEMON: patch_daemon, luci / CONTROLLER: patch_controller}
    for number in (8976, 8977):
        patch = (REPO / f"patches/luci/docker-logs-{number}.patch").read_text()
        for part in patch.split("--- a/")[1:]:
            name, body = part.split("\n", 1)
            path = luci / name
            previous = files.get(path, lambda text: text)
            files[path] = lambda text, previous=previous, body=body: apply_hunks(previous(text), body)
    previous_rpc = files[luci / RPC]
    files[luci / RPC] = lambda text: patch_http_transport(previous_rpc(text))

    # Reject drift before writing any feed file. Reapplication is accepted
    # only when every patched file still has its recorded, reviewed hash.
    audit = root / "swrt-metadata/docker-compat.json"
    if audit.exists():
        recorded = json.loads(audit.read_text())
        if recorded.get("revision") != integration_revision():
            raise ValueError("Docker integration changed; restore pinned feeds before reapplying")
        for path in files:
            if hashlib.sha256(path.read_bytes()).hexdigest() != recorded["files"][str(path.relative_to(root))]:
                raise ValueError("Patched Docker feed changed: " + str(path))
        return
    expected = json.loads((REPO / "scripts/docker-source-hashes.json").read_text())
    output = {}
    for path, change in files.items():
        data = path.read_bytes()
        key = str(path.relative_to(root)).replace("\\", "/")
        if hashlib.sha256(data).hexdigest() != expected[key]:
            raise ValueError("Pinned Docker source changed: " + str(path))
        output[path] = change(data.decode()).encode()
    for path, data in output.items():
        path.write_bytes(data)
    audit.parent.mkdir(parents=True, exist_ok=True)
    audit.write_text(json.dumps({"revision": integration_revision(), "menu": NEW, "legacy_routes": OLD,
        "log_fixes": ["openwrt/luci#8976", "openwrt/luci#8977"],
        "files": {str(path.relative_to(root)): hashlib.sha256(data).hexdigest()
                  for path, data in output.items()}}, indent=2) + "\n")
    print("Applied Docker sidebar, router forwarding and multiplexed log compatibility")


def patch_daemon(text):
    changes = {
        '\tlocal alt_config_file data_root log_level iptables ip6tables bip\n':
        '\tlocal alt_config_file data_root log_level iptables ip6tables bip ip_forward_no_drop\n',
        '\tconfig_get_bool ip6tables globals ip6tables "0"\n':
        '\tconfig_get_bool ip6tables globals ip6tables "0"\n'
        '\tconfig_get_bool ip_forward_no_drop globals ip_forward_no_drop "1"\n',
        '\tjson_add_boolean "ip6tables" "${ip6tables}"\n':
        '\tjson_add_boolean "ip6tables" "${ip6tables}"\n'
        '\tjson_add_boolean "ip-forward-no-drop" "${ip_forward_no_drop}"\n',
        '\tconfig_get extra_iptables_args "${cfg}" extra_iptables_args\n':
        '\t# Block new WAN ingress while allowing replies to container egress.\n'
        '\tconfig_get extra_iptables_args "${cfg}" extra_iptables_args '
        '\'--match conntrack ! --ctstate RELATED,ESTABLISHED\'\n',
    }
    for old, new in changes.items():
        if text.count(old) != 1:
            raise ValueError("Docker init context changed")
        text = text.replace(old, new, 1)
    return text


def patch_http_transport(text):
    marker = "const CLIENT_VER = '1';\n"
    if text.count(marker) != 1:
        raise ValueError("Docker transport constants changed")
    text = text.replace("sock.send(", "send_all(sock, ")
    text = text.replace("response_buff = sock.recv(BLOCKSIZE);", "response_buff = read_http_start(sock);")
    helpers = (REPO / "patches/luci/docker-http-helpers.uc").read_text()
    return text.replace(marker, marker + "\n" + helpers + "\n", 1)


def patch_controller(text):
    marker = "import { stdout } from 'fs';\n"
    if text.count(marker) != 1:
        raise ValueError("Docker streaming imports changed")
    text = text.replace(marker, marker + "import * as http from 'luci.http';\n", 1)
    return patch_http_transport(text)


if __name__ == "__main__":
    patch_docker(sys.argv[1])
