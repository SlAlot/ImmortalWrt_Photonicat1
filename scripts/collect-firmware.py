#!/usr/bin/env python3
"""Verify image checksums, boot headers and installed packages before publishing."""
import hashlib
import json
import pathlib
import re
import shutil
import struct
import sys
import zlib

build = pathlib.Path(sys.argv[1])
out = pathlib.Path(sys.argv[2])
version = sys.argv[3]
assert re.fullmatch(r"[1-9][0-9]*\.[0-9]", version), "Invalid firmware version"
out.mkdir(parents=True, exist_ok=True)
assert not any(out.iterdir()), "Release output directory must be empty"
audit = build / "swrt-metadata"
audit.mkdir(parents=True, exist_ok=True)
target = build / "bin/targets/rockchip/armv8"
profiles = json.loads((target / "profiles.json").read_text())
profile = profiles["profiles"]["ariaboard_photonicat"]
assert "ariaboard,photonicat" in profile["supported_devices"]
manifests = list(target.glob("*ariaboard_photonicat.manifest"))
assert len(manifests) == 1, "Expected exactly one Photonicat manifest"
packages = {line.split(" - ", 1)[0] for line in manifests[0].read_text().splitlines()}
required = {"qmodem", "tom_modem", "ubus-at-daemon", "quectel-CM-5G-M",
            "qmodem-smsd", "sms-forwarder-next",
            "ttyd", "luci-app-ttyd", "luci-i18n-ttyd-zh-cn", "curl", "luci-app-package-manager",
            "luci-app-diskman", "luci-i18n-diskman-zh-cn", "parted", "blkid",
            "smartmontools", "btrfs-progs", "kmod-fs-btrfs", "lsblk",
            "luci-app-swrt-upgrade", "jq-full", "flock", "coreutils-sha256sum",
            "coreutils-stat",
            "luci-app-qmodem-next", "wlmb-server", "quickstart",
            "luci-app-quickstart", "luci-app-store", "dockerd", "docker",
            "pcat-mgr", "luci-app-passwall", "luci-app-openclash",
            "kmod-mt7921e", "kmod-mt7921u", "kmod-mt7921s",
            "kmod-mt7921-firmware", "kmod-mt7922-firmware", "kmod-mt792x-usb",
            "mwan3", "iptables-nft", "ip6tables-nft", "ipset", "ip-full",
            "docker-compose", "luci-app-dockerman", "modem_scan"}
assert required <= packages, f"Missing installed packages: {required - packages}"
forbidden = {"luci-app-modemband", "modemband", "luci-app-sms-tool-js",
             "luci-app-qmodem", "luci-app-qmodem-sms", "luci-app-qmodem-mwan",
             "luci-app-qmodem-ttl", "luci-app-qmodem-hc",
             "qmodem-uplink-manager", "luci-app-qmodem-uplink",
             "iptables-zz-legacy", "ip6tables-zz-legacy"}
assert not forbidden & packages, f"Conflicting installed packages: {forbidden & packages}"
identity_path = build / "files/etc/swrt-release.json"
identity = json.loads(identity_path.read_text(encoding="utf-8"))
assert identity["repository"] == "SlAlot/ImmortalWrt_Photonicat1"
assert identity["board"] == "ariaboard,photonicat"
assert identity["version"] == version, "Embedded firmware version differs from release"
shutil.copy2(identity_path, audit / "firmware-identity.json")

verified = []
for info in profile["images"]:
    if info["type"] != "sysupgrade":
        continue
    src = target / info["name"]
    assert src.name == info["name"], "Invalid profile image name"
    digest = hashlib.sha256(src.read_bytes()).hexdigest()
    assert digest == info["sha256"], f"Checksum mismatch: {src.name}"
    decoder = zlib.decompressobj(31)
    prefix = bytearray()
    expanded = 0
    # fwtool appends metadata after the gzip member; zlib intentionally allows
    # that trailer, whereas gzip.open() can reject it as an extra gzip member.
    with src.open("rb") as compressed:
        while chunk := compressed.read(1024 * 1024):
            data = decoder.decompress(chunk)
            expanded += len(data)
            if len(prefix) < 9 * 1024 * 1024:
                prefix.extend(data[:9 * 1024 * 1024 - len(prefix)])
    assert decoder.eof, "Incomplete gzip image"
    assert prefix[510:512] == b"\x55\xaa", "Missing MBR"
    assert prefix[0x8000:0x8004] == b"RKNS", "Missing RK3568 loader at sector 64"
    assert prefix[0x800000:0x800004] == b"\xd0\x0d\xfe\xed", "Missing U-Boot FIT"
    assert b"ariaboard,photonicat" in prefix, "Wrong bootloader device tree"
    assert b"ariaboard,photonicat" in decoder.unused_data, "Missing device metadata"
    for offset in (446, 462):
        start, size = struct.unpack_from("<II", prefix, offset + 8)
        assert start and size and (start + size) * 512 <= expanded
    name = f"immortalwrt-photonicat-1-{info['filesystem']}-sysupgrade-{version}.img.gz"
    shutil.copy2(src, out / name)
    verified.append({"file": name, "source_file": src.name,
                     "sha256": digest, "expanded_bytes": expanded})

assert {entry["filesystem"] for entry in profile["images"] if entry["type"] == "sysupgrade"} == {"ext4", "squashfs"}
for src in [target / "profiles.json", manifests[0], *target.glob("*.buildinfo")]:
    shutil.copy2(src, audit / src.name)
(audit / "image-validation.json").write_text(json.dumps(verified, indent=2) + "\n")
with (out / "sha256sums").open("w") as checksums:
    for src in sorted(out.iterdir()):
        if src.name != "sha256sums" and src.is_file():
            checksums.write(f"{hashlib.sha256(src.read_bytes()).hexdigest()}  {src.name}\n")
print(json.dumps(verified, indent=2))
