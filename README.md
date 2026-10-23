# SWRT · Photonicat 1

[![Build](https://github.com/SlAlot/ImmortalWrt_Photonicat1/actions/workflows/swrt.yml/badge.svg)](https://github.com/SlAlot/ImmortalWrt_Photonicat1/actions/workflows/swrt.yml)

面向 **光影猫一代（Photonicat 1 / RK3568）** 的定制固件构建项目，基于 ImmortalWrt，集成蜂窝拨号、网络面板、iStore 首页与应用商店、Docker 及多 WAN 故障切换。

通过 GitHub Actions 自动构建，构建与检查通过后发布固件。**本项目不适用于光影猫二代。**

[固件下载](https://github.com/SlAlot/ImmortalWrt_Photonicat1/releases) · [构建记录](https://github.com/SlAlot/ImmortalWrt_Photonicat1/actions/workflows/swrt.yml) · [问题反馈](https://github.com/SlAlot/ImmortalWrt_Photonicat1/issues) · [兼容性说明](docs/COMPATIBILITY.md)

## 目录

- [功能](#功能)
- [默认配置](#默认配置)
- [下载与安装](#下载与安装)
- [首次使用](#首次使用)
- [自动构建](#自动构建)
- [项目结构](#项目结构)
- [已知问题与兼容性](#已知问题与兼容性)
- [问题反馈](#问题反馈)
- [致谢](#致谢)
- [许可](#许可)

## 功能

| 类别 | 组件与用途 |
| --- | --- |
| 蜂窝网络 | QModem Next 界面、Tom AT 核心与 Tom 定制拨号组件，提供模组发现、拨号及管理 |
| 网络面板 | wlmb-server，提供独立 WebUI，并支持与 QModem 共享通道 |
| 管理首页 | iStore QuickStart 首页，含网络面板磁贴与深浅色 Logo，保留 LuCI 状态概览入口 |
| Web 终端 | ttyd，入口：系统 → 终端；LAN 端口 7681，使用系统账号登录 |
| 磁盘管理 | DiskMan 中文界面，入口：系统 → 磁盘管理；含分区、文件系统与 SMART 工具 |
| 在线更新 | SWRT 在线更新，入口：系统 → SWRT 在线更新；从本仓库正式 Release 下载、校验并手动确认升级 |
| 应用商店 | iStore |
| 容器 | Docker、Docker Compose 与 LuCI Docker 管理 |
| 多 WAN | MWAN3，有线 WAN、Wi-Fi 中继与蜂窝链路故障切换 |
| 网络工具 | PassWall、OpenClash、SmartDNS、ZeroTier |
| 设备管理 | CPU 调频、电池状态与光影猫电源管理 |
| 驱动 | QCA9377、WCN6855、MT7603、MT76x2、MT7921/MT7922 无线驱动，以及 USB 2/3、蜂窝数据接口、USB 存储/UAS、ext4 |

蜂窝接口包含通用 QMI、MBIM、NCM、ECM、RNDIS、ACM/WDM 与 PCIe MHI 支持。实际可用协议取决于模组型号、固件与连接方式。

### Wi-Fi 网卡支持

当前构建已预置以下驱动，旧版固件是否包含，请以对应版本的软件包清单为准：

| 芯片 / 系列 | 接口 | 预置驱动 |
| --- | --- | --- |
| QCA9377（板载无线） | SDIO | `ath10k-sdio`，含 QCA9377 固件 |
| WCN6855 / QCNFA765 | PCIe | `ath11k-pci`，含 WCN6855 固件 |
| MT7603 | PCIe | `mt7603` |
| MT76x2 系列 | PCIe | `mt76x2` |
| MT7921 / MT7922 | PCIe | 共用 `mt7921e`，含两种芯片的固件 |
| MT7921 系列对应 USB / SDIO 型号 | USB / SDIO | `mt7921u` / `mt7921s` |

**驱动已集成不代表所有网卡型号均已实测。** 还需匹配具体芯片、设备 ID 和接口；例如 MT76x2 的 PCIe 驱动不等于支持其 USB 型号。更换网卡后，到“网络 → 无线”重新配置；蓝牙不在此支持列表内。

## 默认配置

| 项目 | 默认值 |
| --- | --- |
| 设备主机名 | `S-Photonicat1` |
| 固件标识 / 终端 Banner | `SWRT` |
| LAN 地址 / 网关 | `192.168.17.1/24` |
| 管理页面 | [http://192.168.17.1](http://192.168.17.1) |
| 网络面板 | [http://192.168.17.1:1117](http://192.168.17.1:1117) |
| 系统分支 | ImmortalWrt `openwrt-25.12` |
| 软件包格式 | APK |
| 根分区大小 | 1 GiB |

当前扩展 Wi-Fi 预设面向 **QCNFA765 / WCN6855**：SSID 为 `ImmortalWrt_5G`，密码为 `123456789`。板载无线中继默认关闭；其他扩展网卡可能需要重新配置。首次设置建议通过 LAN 网口连接，登录后修改管理密码与无线密码。

## 下载与安装

### 获取固件

只从本仓库 [Releases](https://github.com/SlAlot/ImmortalWrt_Photonicat1/releases) 下载**光影猫一代**固件。首次安装通常选 `squashfs`；更新时选择与当前系统相同的镜像类型：

| 文件名特征 | 内容 |
| --- | --- |
| `immortalwrt-photonicat-1-squashfs-sysupgrade-<版本号>.img.gz` | SquashFS 完整镜像 |
| `immortalwrt-photonicat-1-ext4-sysupgrade-<版本号>.img.gz` | ext4 完整镜像 |
| `sha256sums` | 发布文件的 SHA-256 校验清单 |

版本号从 `1.0` 开始，依次为 `1.1`、`1.2`，到 `1.9` 后递增为 `2.0`。Release 仅保留上述三个附件，下载后使用 `sha256sums` 校对文件完整性。GitHub 自动显示的 “Source code” 是项目源码，不能用于刷机。

实际安装的软件包清单、最终构建配置、源码与 feeds 版本、镜像检查报告和日志保存在对应 Actions 构建的 `SWRT-build-diagnostics-<构建编号>` 附件中，保留 7 天。

### 先选对安装方式

| 你的情况 | 使用方式 | 固件是否解压 |
| --- | --- | --- |
| 第一次安装、从其他固件切换、系统无法启动 | USB 线刷（RKDevTool） | **必须解压成 `.img`** |
| 已在使用本项目 SWRT，更新到新版且镜像类型相同 | LuCI 网页升级 | **直接上传 `.img.gz`，无需解压** |

需要切换 `squashfs` / `ext4` 或恢复默认分区布局时，按首次安装方式线刷。**不要使用 iStoreOS 在线升级，也不要上传其他设备或其他项目的固件。**

### 第一次刷入：USB 线刷

1. 备份原有配置和重要数据，下载固件并核对 `sha256sums`。
2. **将 `.img.gz` 解压为 `.img`**。从[官方工具下载页](https://dl.photonicat.com/tools/)准备 RKDevTool、驱动，以及官方教程指定的一代 `MiniLoaderAll.bin`。
3. 按[官方刷机教程](https://photonicat.com/wiki/Photonicat_刷机操作手册)中**主线内核**的方式连接 USB、进入 MaskROM，确认工具发现设备。
4. 在 RKDevTool 的“下载镜像”页选择 Loader 和解压后的完整 `.img`，**整盘镜像地址为 `0x00000000`**，点击“执行”。跨系统是否需要擦除，按官方教程操作；擦除会清空数据。
5. 等待刷写完成并重启，期间不要断电或拔线。电脑接 LAN 网口，打开 [http://192.168.17.1](http://192.168.17.1)，设置管理密码、Wi-Fi 和拨号。

**不要把 `.gz` 直接交给 RKDevTool，也不要套用官方旧版固件的“升级固件”页流程。**

### 已安装 SWRT：网页更新固件

1. 电脑通过 LAN 网线连接，进入“系统 → 备份与升级”，先生成并下载配置备份。
2. 下载本仓库新版、与当前系统类型相同的镜像，核对 `sha256sums`。
3. 在“刷写新的固件”中，**直接上传原始 `.img.gz` 文件，无需解压**。
4. **建议取消“保留配置”**，校验通过后再确认刷写。这样更新后需重新设置密码、Wi-Fi 和 APN，能避免旧配置覆盖新版默认设置。
5. 等待自动重启，期间不要断电。未保留配置时，重新访问 [http://192.168.17.1](http://192.168.17.1) 完成设置。

若提示镜像不兼容、校验失败或分区布局变化，先停止升级，按上面的 USB 线刷步骤处理，**不要勾选“强制刷写”**。跨项目的旧备份不要整套恢复；额外安装的软件包和容器数据需另行备份。

### SWRT 在线更新

1. 打开“系统 → SWRT 在线更新”，点击“检查更新”。
2. 点击“下载配置备份”，将备份保存到电脑；容器等重要数据另行备份。
3. 点击“下载并校验”，等待大小、SHA256 和系统兼容性检查通过。
4. 点击“确认升级”，核对版本和配置选项后开始刷写，期间不要断电。

**默认不保留配置**，重启后访问 `192.168.17.1` 重新设置。下载完成不会自动刷写；只接收本仓库的正式新版，自动匹配当前 SquashFS / ext4 类型，不提供强制刷写或回刷入口。GitHub 无法访问时会明确提示失败，可改用上面的网页手动更新。

首次使用需先手动刷入包含在线更新插件及版本标识的新固件；旧固件无法靠安装界面补出可靠的版本身份。固件类型切换、分区变化和系统无法启动仍按 USB 线刷步骤处理。

## 首次使用

### 蜂窝拨号与网络面板

1. 打开 QModem 页面，扫描并确认模组型号、AT 端口与数据接口。
2. 根据运营商要求填写 APN，选择模组实际支持的拨号协议，再启用拨号。
3. 验证接口地址、默认路由、DNS 与实际联网情况。
4. 打开网络面板，查看信号、模组及网络状态。

QModem 默认使用 Tom AT 工具，并启用 ubus 共享支持；拨号组件使用 Tom 定制的 Quectel CM。界面仅启用 `luci-app-qmodem-next`，排除依赖旧界面的 SMS、MWAN、TTL 和 HC 插件。Next 所需的短信后端及转发组件正常保留。

默认开启 USB 扫描，开机扫描由 procd 托管并等待扫描服务就绪；可在 QModem 设置中关闭对应扫描。扫描开关会显式保存，避免上游界面将默认值删除后导致重启不扫描。

QModem 负责蜂窝拨号，网络面板默认使用 `auto` 模式识别共享通道。QModem 已占用 AT 端口时，不要将面板强制切换为独立串口模式。

### 多 WAN 故障切换

默认优先顺序为：

```text
有线 WAN → Wi-Fi 中继 → 蜂窝网络
```

Wi-Fi 中继需自行配置。QModem 创建的 IPv4 拨号接口首次上线时会加入 MWAN3 策略；IPv6 与管理桥接口不加入该策略。删除模组实例后，可在 MWAN3 中清理对应旧成员。

软、硬件流量卸载默认均开启。硬件选项是否实际产生硬件转发取决于网卡、内核驱动及连接路径，需在设备上验证，不能仅凭界面开关判断。MWAN3 使用固定 feeds 中的 iptables-nft 兼容方案；具体切换与代理组合仍需实测。为避免多个策略路由服务同时接管出口，不集成 QModem 的另一套 uplink manager；PassWall 与 OpenClash 应按实际需求选用，避免同时接管相同流量。

RK3568 的源码判断、相关 GitHub 项目、软件与硬件卸载区别及只读检查方法见[流量卸载研究](docs/OFFLOADING-RK3568.md)。

### iStore 与 Docker

在 iStore 中安装与当前系统架构、软件包格式及依赖相符的应用。

首页加入网络面板快捷磁贴，点击进入 LuCI → 服务 → 网络面板，Logo 跟随 Argon 明暗模式。终端入口在 **系统 → 终端**，登录保留 BusyBox 和 SWRT 字符画，下方标注作者 `SlAlot` 和 `ImmortalWrt`；不再显示 APK 对照表和空密码提示文字。

QuickStart 0.13.0 会额外请求 `packages.adb.asc`，ImmortalWrt 源没有此文件。本项目改为检测当前 APK 配置中的所有索引 `packages.adb`（最多缓存 60 秒）；真实的网络、DNS、源连接失败仍显示错误。“软件源配置”进入系统软件包管理页，避免旧向导将 ImmortalWrt 源替换成 OpenWrt 源。默认软件源使用南京大学 ImmortalWrt 镜像，iStore 兼容源独立保留；未提供公开二进制索引的构建 feeds 不写入在线源列表。索引可达不代表所有自定义包均有在线更新；内核模块仍须匹配本固件构建版本。

Docker 默认已集成。根分区为 1 GiB，部署容器前建议将 Docker 数据目录设置到独立 ext4 存储，避免镜像与容器数据占满系统盘。

## 自动构建

### 手动触发

1. 打开 [Actions](https://github.com/SlAlot/ImmortalWrt_Photonicat1/actions/workflows/swrt.yml)。
2. 选择 **Build SWRT Photonicat1**。
3. 点击 **Run workflow**，选择 `main` 分支并运行。

### 推送触发

向 `main` 推送构建配置、预置文件、软件包、脚本、测试或工作流变更时自动构建。仅修改 README 或文档不会触发完整固件编译。Pull Request 运行检查任务。

`main` 分支构建成功后自动发布到 Releases。依赖解析、必需插件检查、编译或镜像验证失败时，不发布该次固件。

发布版本根据仓库中已有的 `v<版本号>` Release 自动递增。仅整理命名与发布文件时，维护提交可加 `[skip firmware]` 跳过完整编译，脚本与集成检查仍照常运行；手动运行工作流仍执行完整构建。

### 修改配置与依赖

- 在 [`.config`](.config) 中调整构建选项。
- 在 [`files/`](files/) 中维护固件预置文件。
- 源码与 feeds 使用固定提交，版本记录在 [`sources.lock.json`](sources.lock.json)；更新 feeds 时同步修改 [`feeds.conf.default`](feeds.conf.default)。
- 网络面板使用作者正式发布的 ARM64 musl 程序，经固定 SHA-256 校验后封装为系统原生软件包。更新时同步修改锁文件及 [软件包定义](package/wlmb-server/Makefile) 中的版本与摘要。

## 项目结构

```text
.
├── .github/workflows/swrt.yml  # 自动检查、编译与发布
├── .config                    # 固件构建配置
├── feeds.conf.default         # feeds 与固定提交
├── sources.lock.json          # 源码与依赖版本记录
├── diy.sh                     # 编译前自定义命令
├── files/                     # 固件预置文件
├── package/wlmb-server/        # 网络面板软件包定义
├── scripts/                   # 配置检查与镜像验证脚本
├── tests/                     # 构建集成测试
└── docs/                      # 兼容性与发布说明
```

## 已知问题与兼容性

- **依赖与上游审查**：修复记录、证据和剩余验证范围见 [2026-10-22 检查报告](docs/AUDIT-2026-10-22.md)。
- **首页兼容性**：已修复 QuickStart 启动稍慢时，LuCI 缓存回退路由导致首页一直跳回状态页的问题。其他组件兼容性见 [兼容性说明](docs/COMPATIBILITY.md)，本次实机修复记录见 [检查记录](docs/REPAIR-2026-10-23.md)。
- **固件更新**：本项目使用 iStore 首页与商店，系统仍基于 ImmortalWrt；固件更新请使用本仓库发布的版本，不使用 iStoreOS OTA 镜像。
- **软件包兼容性**：系统使用 APK；其他固件的 IPK 或不同内核 ABI 的驱动不能直接混装。商店中的应用仍需核对设备兼容性。
- **验证范围**：自动检查覆盖构建配置、必需软件包、镜像完整性与引导结构。实际启动、无线、蜂窝拨号与故障切换需要真机验证。

## 问题反馈

请在 [Issues](https://github.com/SlAlot/ImmortalWrt_Photonicat1/issues) 中提供：

- 固件版本或对应的 Actions / Release 链接；
- 光影猫硬件配置、无线网卡与蜂窝模组型号；
- 安装方式、复现步骤及实际现象；
- 相关错误信息或日志。

反馈蜂窝问题时，补充所用协议与连接方式；公开日志前隐去 SIM 身份、电话号码、凭据等个人信息。

## 致谢

感谢以下项目及其贡献者：

- [ImmortalWrt](https://github.com/immortalwrt/immortalwrt)
- [原始光影猫构建项目](https://github.com/a757814283/ImmortalWrt_Photonicat1)
- [QModem](https://github.com/FUjr/QModem)
- [网络面板 · wlmb-server](https://github.com/SlAlot/wlmb-server)
- [iStore QuickStart](https://github.com/linkease/nas-packages-luci/tree/main/luci/luci-app-quickstart) 与 [NAS Packages](https://github.com/linkease/nas-packages)
- [iStore](https://github.com/istoreos/istore)

## 许可

本仓库许可见 [LICENSE](LICENSE)。固件内的第三方组件遵循各自许可；QModem 与网络面板的非商业使用限制，以对应项目的许可文件为准。
