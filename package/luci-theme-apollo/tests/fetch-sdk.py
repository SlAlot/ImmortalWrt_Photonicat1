import hashlib
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen


MIRRORS = ('https://downloads.openwrt.org', 'https://downloads.cdn.openwrt.org')
CHUNK_SIZE = 8 * 1024 * 1024


def fetch(path, limit, byte_range=None):
    headers = {'Range': f'bytes={byte_range[0]}-{byte_range[1]}'} if byte_range else {}
    for host in MIRRORS * 3:
        try:
            with urlopen(Request(f'{host}/{path}', headers=headers), timeout=20) as response:
                content_range = response.headers.get('Content-Range', '')
                if byte_range and not re.fullmatch(rf'bytes {byte_range[0]}-{byte_range[1]}/\d+', content_range):
                    continue
                data = response.read(limit + 1)
                if (len(data) == limit if byte_range else len(data) <= limit):
                    return data, content_range
        except (OSError, URLError):
            continue
    raise RuntimeError(f'无法下载 {path}，字节区间 {byte_range}')


def main(version, root):
    relative = f'releases/{version}/targets/x86/64'
    destination = Path(root) / relative
    destination.mkdir(parents=True)
    for name in ('sha256sums', 'sha256sums.asc'):
        data, _ = fetch(f'{relative}/{name}', 1024 * 1024)
        (destination / name).write_bytes(data)
    sums = (destination / 'sha256sums').read_text(encoding='ascii')
    sdk = re.search(r'^([0-9a-f]{64}) \*(openwrt-sdk-[^ /]+\.tar\.(?:xz|zst))$', sums, re.M)
    if not sdk:
        raise RuntimeError('校验清单缺少 x86_64 SDK')
    expected, archive = sdk.groups()
    path = f'{relative}/{archive}'
    _, probe = fetch(path, 1, (0, 0))
    total = int(probe.rsplit('/', 1)[1])

    def chunk(start):
        end = min(start + CHUNK_SIZE, total) - 1
        return fetch(path, end - start + 1, (start, end))[0]

    # 分段下载便于重试，拼接后按清单校验。SDK 容器还会检查清单的 GPG 签名。
    print(f'{archive}: {total} bytes', flush=True)
    digest = hashlib.sha256()
    with (destination / archive).open('wb') as output, ThreadPoolExecutor(max_workers=6) as pool:
        for data in pool.map(chunk, range(0, total, CHUNK_SIZE)):
            output.write(data)
            digest.update(data)
    if digest.hexdigest() != expected:
        raise RuntimeError('SDK 的 SHA256 与校验清单不符')
    print(f'{archive}: SHA256 verified', flush=True)


if __name__ == '__main__':
    main(*sys.argv[1:])
