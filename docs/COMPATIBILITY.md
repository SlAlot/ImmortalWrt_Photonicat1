# Compatibility and device acceptance

## QuickStart and iStore

- Include the QuickStart backend, Lua compatibility, iStore task services and storage utilities. The page package alone is insufficient.
- Upstream forbids JS/CSS re-minification; the build checks its settings. See [#76](https://github.com/linkease/nas-packages-luci/issues/76).
- An explicit homepage menu is registered; standard status remains available. QuickStart runs under procd with respawn. If the page fails, inspect `logread -e quickstart`, its process and browser errors. See [#87](https://github.com/linkease/nas-packages-luci/issues/87).
- Language resources are included upstream. Refresh browser assets after upgrading before treating stale English text as a missing translation. See [#80](https://github.com/linkease/nas-packages-luci/issues/80).
- Theme CSS can affect widgets; Argon is retained without risky global CSS overrides. Verify on the device. See [#91](https://github.com/linkease/nas-packages-luci/issues/91).
- No iStoreOS OTA/sandbox firmware implementation is added. The homepage update check is disabled. Use SWRT Releases for firmware.
- Current iStore supports APK. App architecture, dependencies and kernel ABI must still match; do not force incompatible IPK or drivers.
- Temperature/storage fields depend on platform support in the upstream binary. Compilation cannot prove every widget reports a real value. See [#108](https://github.com/linkease/nas-packages-luci/issues/108).

## QModem and Network Panel

- QModem Next is the single QModem main UI. Legacy QModem/MWAN UI packages are excluded.
- Tom AT is the default (`qmodem.main.at_tool=0`) with ubus support enabled; the Tom-customized Quectel CM is selected. Legacy SMS/MWAN/TTL/HC UI packages that depend on `luci-app-qmodem` are excluded. Next's `qmodem-smsd` and `sms-forwarder-next` backends remain required.
- The pinned QModem recipe's missing `kmod-mhi-wwan` dependency is mapped to this kernel's actual `kmod-mhi-net` package. The unrelated WeeChat virtual-provider cycle is fixed by selecting `weechat-minimal` explicitly in its LuCI recipe. These guarded changes are applied before feed indexes are regenerated.
- QModem controls dialing. Network Panel keeps auto mode and its shared-channel ownership checks. Do not force standalone mode while QModem owns its AT port.
- Use generic kernel USB/MHI drivers; do not mix competing vendor driver stacks. USB composition and modem firmware still determine usable protocols.
- MWAN3 enrollment only accepts the matching QModem IPv4 interface; IPv6 and management bridges are excluded. Repeated events preserve user changes. Remove stale MWAN3 members manually when deleting modem instances.

## Docker and storage

The original 1 GiB root partition is retained. Move Docker data to suitable ext4 storage before running large containers. No network-facing Docker API is enabled. Test container DNS/access together with proxies and multi-WAN rules on hardware.

## Hardware acceptance still required

1. Flash the decompressed full image; check cold boot, reboot, battery management, eMMC/SD behavior.
2. Confirm S-Photonicat1, 192.168.17.1, SWRT banner, Wi-Fi and Ethernet.
3. Set the real APN/protocol, test QModem dialing and reconnects.
4. Verify Network Panel shared measurements/AT access without contention.
5. Test authenticated QuickStart/iStore requests, widgets and package compatibility.
6. Test a small Docker container, proxy traffic and WAN failure/recovery.

CI checks dependencies, resolved config, image boot headers, package manifests and integration behavior. It cannot replace these device tests.
