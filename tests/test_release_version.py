import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("release_version", Path(__file__).resolve().parents[1] / "scripts/release-version.py")
release_version = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release_version)


class ReleaseVersionTests(unittest.TestCase):
    def test_first_version_ignores_old_timestamp_tags(self):
        self.assertEqual(release_version.next_version([{"tag_name": "SWRT-Photonicat1-20261021-225317-6"}]), "1.0")

    def test_paginated_history_is_compared_numerically(self):
        history = [[{"tag_name": "v2.0"}, {"tag_name": "v1.9"}], [{"tag_name": "v9.9"}]]
        self.assertEqual(release_version.next_version(history), "10.0")

    def test_minor_rollover_and_existing_draft_reservation(self):
        self.assertEqual(release_version.next_version([{"tag_name": "v1.9", "draft": True}]), "2.0")

    def test_regular_increment(self):
        self.assertEqual(release_version.next_version([{"tag_name": "v1.0"}]), "1.1")
