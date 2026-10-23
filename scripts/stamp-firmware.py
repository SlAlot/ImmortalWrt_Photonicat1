#!/usr/bin/env python3
"""Embed the release version before rootfs compilation, shared by both image types."""
import json
from pathlib import Path
import re
import sys


def stamp(build, version, commit):
    if not re.fullmatch(r"[1-9][0-9]*\.[0-9]", version):
        raise ValueError("Invalid firmware version")
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise ValueError("Invalid source commit")
    identity = {"repository": "SlAlot/ImmortalWrt_Photonicat1",
                "board": "ariaboard,photonicat", "version": version, "commit": commit}
    path = Path(build) / "files/etc/swrt-release.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(identity, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    stamp(*sys.argv[1:])
