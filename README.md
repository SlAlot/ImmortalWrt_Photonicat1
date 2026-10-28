# SWRT · Photonicat 1

[![Build](https://github.com/SlAlot/ImmortalWrt_Photonicat1/actions/workflows/swrt.yml/badge.svg)](https://github.com/SlAlot/ImmortalWrt_Photonicat1/actions/workflows/swrt.yml)

**SWRT 2.0** 是面向光影猫一代（Photonicat 1 / RK3568）的 ImmortalWrt 定制固件，由 **SlAlot** 维护。支持 **1+8、2+16、4+64 GB** 配置，不适用于二代。

[下载固件](https://github.com/SlAlot/ImmortalWrt_Photonicat1/releases/latest) · [版本说明](docs/RELEASE-NOTES.md) · [兼容性说明](docs/COMPATIBILITY.md) · [问题反馈](https://github.com/SlAlot/ImmortalWrt_Photonicat1/issues)

## 功能

| 功能 | 内容 |
| --- | --- |
| 蜂窝网络 | QModem Next、Tom AT 核心与 Tom 拨号组件，支持模组发现、拨号和短信管理 |
| 网络面板 | wlmb-server，查看信号、模组和网络状态，支持与 QModem 共享通道 |
| 管理首页 | iStore QuickStart，内置网络面板磁贴，手机端左右滑动 |
| 应用与容器 | iStore、Docker、Docker Compose，独立 Docker 管理菜单 |
| 设备管理 | 光影猫管理、电池状态、CPU 调频、DiskMan 磁盘管理、ttyd 终端 |
| 网络工具 | MWAN3、PassWall、OpenClash、SmartDNS、ZeroTier |
| 固件更新 | SWRT 在线更新，默认国内加速，可切换 GitHub 官方源 |
| 存储 | 首次开机自动扩展 eMMC 分区及文件系统，适配 8 / 16 / 64 GB |

### Wi-Fi 网卡支持

| 芯片 / 系列 | 接口 | 内置驱动 |
| --- | --- | --- |
| QCA9377（板载） | SDIO | ath10k-sdio，含固件 |
| WCN6855 / QCNFA765 | PCIe | ath11k-pci，含固件 |
| MT7603 | PCIe | mt7603 |
| MT76x2 | PCIe | mt76x2 |
| MT7921 / MT7922 | PCIe | mt7921e，含两种芯片固件 |
| MT7921 对应 USB / SDIO 型号 | USB / SDIO | mt7921u / mt7921s |

已集成驱动不代表所有具体网卡均已实测，芯片、设备 ID 和接口须匹配；蓝牙不在此列表内。另含 USB 2/3、USB 存储/UAS，以及 QMI、MBIM、NCM、ECM、RNDIS、ACM/WDM 和 PCIe MHI 蜂窝接口支持。

## 默认配置

| 项目 | 默认值 |
| --- | --- |
| 主机名 | `S-Photonicat1` |
| 管理地址 | [192.168.17.1](http://192.168.17.1) |
| 管理账号 / 密码 | `root` / 空密码，首次登录后设置 |
| 网络面板 | 首页磁贴或“服务 → 网络面板”，独立端口 `1117` |
| 终端 | “系统 → 终端”，Banner 为 SWRT |
| 系统 | ImmortalWrt `openwrt-25.12`，使用 APK 软件包 |
| 流量卸载 | 软件、硬件选项默认均开启 |

扩展网卡的无线预设面向 QCNFA765 / WCN6855：SSID `ImmortalWrt_5G`，密码 `123456789`。板载无线中继默认关闭；更换网卡后到“网络 → 无线”重新配置。首次设置建议使用 LAN 网线。

## 下载与安装

从 [Releases](https://github.com/SlAlot/ImmortalWrt_Photonicat1/releases/latest) 下载固件，并用同次发布的 `sha256sums` 核对文件。首次安装通常选 SquashFS，更新时保持当前系统类型。

| 下载文件 | 用途 |
| --- | --- |
| `immortalwrt-photonicat-1-squashfs-sysupgrade-2.0.img.gz` | SquashFS 固件 |
| `immortalwrt-photonicat-1-ext4-sysupgrade-2.0.img.gz` | ext4 固件 |
| `sha256sums` | SHA-256 校验清单 |

### 第一次刷入：USB 线刷

1. 备份重要数据，下载固件，**将 `.img.gz` 解压成 `.img`**。
2. 从[官方工具页](https://dl.photonicat.com/tools/)准备 RKDevTool、驱动和一代 `MiniLoaderAll.bin`，按[官方教程](https://photonicat.com/wiki/Photonicat_刷机操作手册)的主线内核方式进入 MaskROM。
3. 在 RKDevTool“下载镜像”页选择 Loader 和完整 `.img`，整盘镜像地址填 **`0x00000000`**，执行刷写。
4. 保持供电，等待启动及自动扩容完成；首次启动可能额外重启一次。访问 `192.168.17.1`，设置密码、Wi-Fi 和拨号。

从其他系统切换、切换 SquashFS / ext4 或系统无法启动时，也使用 USB 线刷。不要把 `.gz` 直接交给 RKDevTool。

### 已安装 SWRT：网页升级

**v1.9 及更早版本首次升级到 v2.0，请用下面的网页上传方式。** 旧在线更新器可能在确认后重启却仍停在原版本，v2.0 已内置修复。

1. 进入“系统 → 备份与升级”，下载配置备份；容器数据另行备份。
2. 上传本仓库与当前系统类型相同的 **`.img.gz`，无需解压**。
3. 校验通过后确认刷写。建议不保留配置，重启后重新设置；需要保留时先核对现有配置。
4. 等待设备重启，期间不要断电。若提示镜像不兼容或分区布局变化，停止操作，不强制刷写。

### v2.0 及以后：在线更新

打开“系统 → SWRT 在线更新”，依次执行 **检查更新 → 下载配置备份 → 下载并校验 → 确认升级**。默认使用 `gh-proxy.com`，可切换 GitHub 官方源；切换后重新检查更新。

下载完成不会自动刷写，默认不保留配置。“恢复配置备份”可进入系统原生恢复页面。只使用本仓库固件，不使用 iStoreOS 的 OTA 镜像。

## 使用说明

### 拨号与网络

在 QModem 中扫描模组、填写运营商 APN，选择模组支持的协议并启用拨号。网络面板保持 `auto` 共享模式，避免与 QModem 争用 AT 串口。

MWAN3 默认优先顺序为 **有线 WAN → Wi-Fi 中继 → 蜂窝网络**。Wi-Fi 中继需自行配置，QModem IPv4 接口上线后自动加入；删除模组后清理旧成员。PassWall 与 OpenClash 避免同时接管相同流量。

### 光影猫管理

进入“系统 → 光影猫管理”，或点击顶部电量按钮。可查看电量、电压、供电来源和主板温度，并选择以下模式：

| 模式 | 用途 |
| --- | --- |
| 手动（默认） | 关闭 UPS 倒计时和定时计划 |
| 车载 / UPS | 接通充电器自动开机后，断电延时 1～600 分钟关机；恢复供电取消倒计时，按键手动开机不启用倒计时 |
| 每日定时 | 按设备本地时间设置每日开关机；修改时区后重启再设置 |

查看状态不会修改策略，保存会替换原计划。电量按电压估算，供电来源不等于实测充电电流；一代没有独立充电开关或电池温度读数。详见[电源说明](package/swrt-pcat-manager/README.md)。

### Docker 与存储

左侧“Docker”管理容器，“系统 → 磁盘管理”管理磁盘。全新 SquashFS 安装的 Docker 数据默认位于 `/overlay/docker`，可自行配置外部原生文件系统目录。

首次启动使用 eMMC 连续可用空间自动扩容，保留额外数据分区；扩展的是存储，运行内存不变。已有 Docker 数据及自定义目录不会自动迁移。**配置备份不包含 Docker 镜像、容器和数据卷**，升级或迁移前另行备份。详见 [Docker](docs/DOCKER-COMPATIBILITY.md) 与[存储说明](docs/STORAGE-RECOVERY.md)。

## 兼容性与反馈

- 只支持光影猫一代；网卡、模组和应用还需满足各自的架构、接口与依赖要求。
- 软件包使用 APK，不混装其他固件的 IPK 或不同内核 ABI 的驱动。
- 软、硬件流量卸载选项均开启，实际硬件加速取决于驱动和数据路径，见[流量卸载说明](docs/OFFLOADING-RK3568.md)。
- 首页提示软件源错误时，检查网络及源地址；默认使用南京大学 ImmortalWrt 镜像和独立 iStore 兼容源。

在 [Issues](https://github.com/SlAlot/ImmortalWrt_Photonicat1/issues) 反馈时，请提供固件版本、硬件配置、网卡或模组型号、复现步骤及相关日志，公开前隐去密码和个人信息。

## 构建与项目文档

在 [Actions](https://github.com/SlAlot/ImmortalWrt_Photonicat1/actions/workflows/swrt.yml) 运行 **Build SWRT Photonicat1**，选择 `main`；版本留空自动递增，关闭 `publish_release` 可仅生成构建附件。

[构建说明](docs/BUILDING.md) · [兼容性](docs/COMPATIBILITY.md) · [首页适配](docs/QUICKSTART-ADAPTATION.md) · [官方电源方案](docs/OFFICIAL-SOURCE-COMPARISON.md)

## 致谢与许可

感谢 [ImmortalWrt](https://github.com/immortalwrt/immortalwrt)、[光影猫官方](https://github.com/photonicat/photonicat_openwrt)、[原始构建项目](https://github.com/a757814283/ImmortalWrt_Photonicat1)、[QModem](https://github.com/FUjr/QModem)、[网络面板](https://github.com/SlAlot/wlmb-server)、[iStore QuickStart](https://github.com/linkease/nas-packages-luci/tree/main/luci/luci-app-quickstart) 与 [iStore](https://github.com/istoreos/istore) 的贡献者。

仓库许可见 [LICENSE](LICENSE)。第三方组件遵循各自许可；QModem 与网络面板的使用限制以对应项目许可为准。
