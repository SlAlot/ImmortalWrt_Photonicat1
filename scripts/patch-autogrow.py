#!/usr/bin/env python3
"""Preserve an expanded Photonicat root partition during normal sysupgrade."""
import hashlib
import json
from pathlib import Path
import sys

ORIGINAL_SHA = 'f4dfef5d7deaaee64db97be580e946740da45913bea097b2d71f041a3bee693d'
RELATIVE = 'target/linux/rockchip/armv8/base-files/lib/upgrade/platform.sh'


def prepare(root):
    root = Path(root)
    target = root / RELATIVE
    data = target.read_bytes()
    repo = Path(__file__).resolve().parents[1]
    helper = (repo / 'patches/rockchip/swrt-upgrade-partitions.sh').read_bytes()
    audit = root / 'swrt-metadata'
    record = audit / 'autogrow-upgrade.json'
    original = 'diff="$(grep -F -x -v -f /tmp/partmap.bootdisk /tmp/partmap.image)"'
    replacement = 'diff="$(swrt_partition_difference /tmp/partmap.bootdisk /tmp/partmap.image)"'
    if record.exists():
        previous = json.loads(record.read_text())
        if previous.get('helper_sha256') != hashlib.sha256(helper).hexdigest() or previous.get('patched_sha256') != hashlib.sha256(data).hexdigest():
            raise ValueError('Expanded partition upgrade patch changed after preparation')
        return
    if hashlib.sha256(data).hexdigest() != ORIGINAL_SHA:
        raise ValueError('Rockchip upgrade implementation changed; review expanded partition handling')
    text = data.decode()
    if text.count(original) != 2:
        raise ValueError('Expected validation and write paths to compare partition maps')
    result = helper + b'\n' + text.replace(original, replacement).encode()
    target.write_bytes(result)
    audit.mkdir(exist_ok=True)
    record.write_text(json.dumps({
        'original_sha256': ORIGINAL_SHA,
        'patched_sha256': hashlib.sha256(result).hexdigest(),
        'helper_sha256': hashlib.sha256(helper).hexdigest(),
        'preserve_expanded_root': True,
    }, indent=2) + '\n')


if __name__ == '__main__':
    prepare(sys.argv[1])
