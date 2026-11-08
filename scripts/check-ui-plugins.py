#!/usr/bin/env python3
"""Check vendored runtime files against the reviewed standalone repositories."""
import hashlib
import json
from pathlib import Path


def snapshot(root):
    files = [root / 'Makefile', root / 'LICENSE', *(root / 'root').rglob('*'), *(root / 'LICENSES').rglob('*')]
    digest = hashlib.sha256()
    for file in sorted(files, key=lambda file: file.relative_to(root).as_posix()):
        if not file.is_file():
            continue
        name = file.relative_to(root).as_posix().encode()
        data = file.read_bytes()
        digest.update(len(name).to_bytes(4, 'big') + name)
        digest.update(len(data).to_bytes(8, 'big') + data)
    return digest.hexdigest()


def check(repo):
    lock = json.loads((repo / 'sources.lock.json').read_text(encoding='utf-8'))['luci_ui']
    for name in ('luci-theme-apollo', 'luci-app-wlmbstart'):
        item = lock[name]
        assert item['repository'] == f'https://github.com/SlAlot/{name}', 'Unexpected UI source'
        assert len(item['commit']) == 40, 'UI revision must be pinned'
        assert snapshot(repo / 'package' / name) == item['runtime_sha256'], f'UI snapshot changed: {name}; sync the reviewed source and lock together'
    print('Validated Apollo and wlmbstart source pins and runtime snapshots')


if __name__ == '__main__':
    check(Path(__file__).resolve().parents[1])
