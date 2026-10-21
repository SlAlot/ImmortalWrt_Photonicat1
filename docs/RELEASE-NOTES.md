SWRT for first-generation Photonicat (RK3568).

- Hostname S-Photonicat1; LAN 192.168.17.1; banner SWRT.
- QModem Next + Network Panel by SlAlot + iStore QuickStart + iStore + Docker.
- Removes legacy modemband and sms-tool-js; retains proxy, Wi-Fi and multi-WAN features.
- Includes pinned sources, resolved config, checksums and boot-header validation.

**RKDevTool USB flashing: decompress .img.gz first and flash the resulting full .img at 0x00000000 with the correct Photonicat1 MiniLoaderAll.bin. Do not flash gzip directly.**

Read FLASHING-README.md and COMPATIBILITY.md. Build verification does not constitute hardware testing.
