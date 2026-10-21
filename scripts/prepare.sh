#!/usr/bin/env bash
set -euo pipefail
repo_dir=$(cd "$(dirname "$0")/.." && pwd)
build_dir=${1:?Usage: prepare.sh IMMORTALWRT_DIRECTORY}
build_dir=$(realpath "$build_dir")
test -f "$build_dir/include/toplevel.mk"

cp "$repo_dir/.config" "$build_dir/.config"
cp "$repo_dir/feeds.conf.default" "$build_dir/feeds.conf.default"
cp -a "$repo_dir/files" "$build_dir/"
mkdir -p "$build_dir/package/swrt"
cp -a "$repo_dir/package/wlmb-server" "$build_dir/package/swrt/"
find "$build_dir/files/etc/uci-defaults" "$build_dir/files/etc/hotplug.d" -type f -exec chmod 755 {} +

cd "$build_dir"
bash "$repo_dir/diy.sh"
./scripts/feeds update -a
python3 "$repo_dir/scripts/patch-feeds.py" "$build_dir"
./scripts/feeds update -i luci qmodem
# Install standard feeds first, then the requested integrations. Do not force
# unrelated NAS packages over existing ImmortalWrt packages.
for feed in packages luci routing telephony video qmodem istore nas nas_luci; do
    ./scripts/feeds install -a -p "$feed"
done

# The upstream frontend explicitly forbids re-minification. Lua is needed by
# QuickStart's template/proxy and iStore even on current JavaScript LuCI.
test -f feeds/nas_luci/luci/luci-app-quickstart/Makefile
grep -q 'LUCI_MINIFY_JS:=0' feeds/nas_luci/luci/luci-app-quickstart/Makefile

# The old tree shipped a complete stale copy of PassWall's firewall script.
# Current pinned upstream has the MWAN mark exemption; verify it before using it.
grep -q 'MWAN3_RULE_ARGS=' feeds/luci/applications/luci-app-passwall/root/usr/share/passwall/nftables.sh

# Feed indexing invokes make with an incomplete package registry and can rewrite
# .config. Restore the intended configuration after all feeds are registered.
cp "$repo_dir/.config" .config
mkdir -p swrt-metadata
make defconfig 2>&1 | tee swrt-metadata/defconfig.log
if grep -Eq 'recursive dependency detected|(^|:)error:' swrt-metadata/defconfig.log; then
    echo 'Kconfig reported an error; refusing to compile a fallback configuration' >&2
    exit 1
fi
python3 "$repo_dir/scripts/check-config.py" .config
cp .config swrt-metadata/config.resolved
cp "$repo_dir/sources.lock.json" swrt-metadata/
./scripts/diffconfig.sh > swrt-metadata/config.diff
./scripts/feeds list -s > swrt-metadata/feeds.resolved
git rev-parse HEAD > swrt-metadata/source.commit
