# SWRT · S-Photonicat1

光影猫一代（RK3568）ImmortalWrt 自用固件，迁移自 [a757814283/ImmortalWrt_Photonicat1](https://github.com/a757814283/ImmortalWrt_Photonicat1)。不适用光影猫二代。

| 项目 | 配置 |
| --- | --- |
| 主机名 | `S-Photonicat1` |
| 管理地址 / LAN 网关 | `192.168.17.1` |
| 终端 Banner | `SWRT` |
| 系统 | ImmortalWrt `openwrt-25.12`，源码与 feeds 固定提交 |
| 首页 | iStore QuickStart，保留状态概览入口 |
| 蜂窝拨号 | QModem + `luci-app-qmodem-next` |
| 网络面板 | SlAlot/wlmb-server 1.1.3，`http://192.168.17.1:1117` |
| 应用商店 | iStore，使用当前系统的 APK 包管理 |
| 容器 | Docker、Docker Compose、LuCI Docker 管理 |

移除 `luci-app-modemband`（原说明中的 modernband）、`luci-app-sms-tool-js`（原说明中的 smsjs）及旧配置。QModem Next 和网络面板保留各自的短信功能。

保留 PassWall、SmartDNS、MWAN3、ZeroTier、CPU 调频、电池管理、板载和扩展无线驱动。修正原来无效的 `luci-app-clash` 包名，实际集成 OpenClash。原 Wi-Fi 预设面向 QCNFA765/WCN6855 扩展网卡，未声称所有网卡均已实测。

## 自动编译

修改 `.config`、`files/`、`package/`、构建脚本或依赖锁后推送到 `main` 自动编译。也可在 [Actions](https://github.com/SlAlot/ImmortalWrt_Photonicat1/actions) 中选择 **Build SWRT Photonicat1 → Run workflow**。

成功后自动发布到 [Releases](https://github.com/SlAlot/ImmortalWrt_Photonicat1/releases)，含 ext4 / squashfs 镜像、校验文件、最终配置、源码/feeds 提交与镜像检查报告。配置丢失必需插件、编译或镜像验证失败时不发布。首次完整编译可能需要数小时。

所有依赖见 `sources.lock.json`。网络面板使用作者正式版 ARM64 musl 程序，验证固定 SHA-256 后作为系统原生包装入固件；首次开机无需下载安装。更新依赖须同步锁文件与 feeds，更新网络面板还需同步 `package/wlmb-server/Makefile` 的版本和摘要。

## USB 线刷：务必先解压

1. 下载文件名含 `ariaboard_photonicat-squashfs-sysupgrade.img.gz` 或 `ext4-sysupgrade.img.gz` 的镜像并核对 SHA-256。
2. **用 7-Zip 等解压 `.img.gz` 得到 `.img`。RKDevTool 必须选择 `.img`，不要直接写 `.gz`。**
3. 按 [官方教程](https://photonicat.com/wiki/Photonicat_刷机操作手册)的主线内核方式进入 MaskROM，在“下载镜像”页选一代对应的 `MiniLoaderAll.bin` 和完整 `.img`，整盘地址 `0x00000000`。擦除会清除数据，先备份需要的配置。
4. 正常重启并等待初始化，通过 LAN 口访问 `http://192.168.17.1`。首次登录后设置自己的管理密码和 Wi-Fi 密码；不要恢复整套旧网络配置覆盖新配置。

构建会验证 gzip、设备元数据、分区边界、sector 64 的 RK3568 loader 和 8 MiB 的 U-Boot FIT。通过构建检查仍不等于真机启动验收。

## QModem 与多 WAN

进入 QModem 页面扫描模组，核对型号、AT 端口和数据接口，再填写真实 APN 并选择 QMI/MBIM/ECM 等协议启用拨号。固件不猜测 SIM/APN。

包含通用 USB QMI、MBIM、NCM、ECM、RNDIS、串口、ACM/WDM 和 PCIe MHI 驱动，以及 USB 2/3、USB 存储/UAS、ext4。避免同时混装互相竞争的厂商驱动。

已移除固定 `usb0` 的旧 DHCP 蜂窝接口。QModem 的 IPv4 拨号接口首次上线时加入原 MWAN3 策略：有线 WAN > Wi-Fi 中继 > 蜂窝。IPv6/管理桥不加入；后续手动修改的成员优先级不会被覆盖。删除模组实例后可在 MWAN3 删除其旧成员。

网络面板保持 `auto` 模式，复用 QModem 的已识别共享通道，不开启第二套拨号服务。仍需真机验证拨号、短信、共享 AT 与故障切换。

## iStore 首页与 Docker

包含 QuickStart 后端、Lua 兼容、iStore 任务服务、磁盘工具和 Docker；保留上游禁止二次压缩的设置，增加明确首页菜单，禁用面向 iStoreOS 的固件更新检查。**本项目是 SWRT / ImmortalWrt，不要刷入 iStoreOS OTA 镜像。**

系统使用 APK，不可混装 IPK 或其他内核 ABI 的驱动。商店可用不代表所有应用兼容。保留原 1 GiB 根分区，Docker 数据建议迁移到独立 ext4 存储，避免系统盘被容器镜像占满。未开放网络 Docker API。

已知兼容问题、上游 Issue 和验收步骤见 [COMPATIBILITY.md](docs/COMPATIBILITY.md)。QuickStart 的主题样式、温度等字段仍需真机确认，不能仅凭编译宣称全部修复。

第三方许可与署名保留。QModem、网络面板的非商业限制继续适用。
