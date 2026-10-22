#!/usr/bin/env python3
"""Choose the next one-digit-minor firmware version from GitHub releases."""
import json
from pathlib import Path
import re
import sys


def next_version(history):
    # gh api --paginate --slurp returns a list of pages; a single page also works.
    releases = [release for page in history for release in
                (page if isinstance(page, list) else [page])]
    numbers = [9]
    for release in releases:
        match = re.fullmatch(r"v([1-9][0-9]*)\.([0-9])", release.get("tag_name", ""))
        if match:
            numbers.append(int(match[1]) * 10 + int(match[2]))
    major, minor = divmod(max(numbers) + 1, 10)
    return f"{major}.{minor}"


if __name__ == "__main__":
    print(next_version(json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))))
