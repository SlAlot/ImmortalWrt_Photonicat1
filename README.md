# SWRT · Photonicat 1

[![Build](https://github.com/SlAlot/ImmortalWrt_Photonicat1/actions/workflows/swrt.yml/badge.svg)](https://github.com/SlAlot/ImmortalWrt_Photonicat1/actions/workflows/swrt.yml)

面向 **光影猫一代（Photonicat 1 / RK3568）** 的 ImmortalWrt 定制固件，集成 QModem Next、网络面板、iStore、Docker、多 WAN、DiskMan、SWRT 在线更新与电源管理。在线更新默认使用国内加速，可切换 GitHub 官方源。

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
| 设备管理 | CPU 调频、电池状态与光影猫管理，支持车载 / UPS 延时关机和每日定时开关机 |
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

### 先选对安装方式

| 你的情况 | 使用方式 | 固件是否解压 |
| --- | --- | --- |
| 第一次安装、从其他固件切换、系统无法启动 | USB 线刷（RKDevTool） | **必须解压成 `.img`** |
| 已在使用本项目 SWRT，更新到新版且镜像类型相同 | LuCI 网页升级 | **直接上传 `.img.gz`，无需解压** |
| 已安装 v1.5 及以后的 SWRT 在线更新功能 | 系统 → SWRT 在线更新 | 自动选择同类型固件，无需手动解压 |

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

1. 打开“系统 → SWRT 在线更新”，默认使用国内加速 `gh-proxy.com`，也可切换 GitHub 官方源，再点击“检查更新”。
2. 点击“下载配置备份”，将备份保存到电脑；容器等重要数据另行备份。
3. 点击“下载并校验”，等待大小、SHA256 和系统兼容性检查通过。
4. 点击“确认升级”，核对版本和配置选项后开始刷写，期间不要断电。

需要还原已保存的配置时，点击“恢复配置备份”，进入系统原生页面上传并确认恢复。

**默认不保留配置**，重启后访问 `192.168.17.1` 重新设置。下载完成不会自动刷写；只接收本仓库的正式新版，自动匹配当前 SquashFS / ext4 类型，不提供强制刷写或回刷入口。更新源切换后自动保存，版本查询、校验清单和固件下载均走所选源；连接失败可换源重新检查，或使用上面的网页手动更新。

**v1.3 等旧版本需先用上面的网页手动升级到 v1.5 或更新版本**，之后才可使用此入口。切换固件类型、分区变化或无法启动时仍需 USB 线刷。

## 首次使用

### 蜂窝拨号与网络面板

1. 打开 QModem 页面，扫描并确认模组型号、AT 端口与数据接口。
2. 根据运营商要求填写 APN，选择模组实际支持的拨号协议，再启用拨号。
3. 验证接口地址、默认路由、DNS 与实际联网情况。
4. 打开网络面板，查看信号、模组及网络状态。

QModem 使用 Tom AT 核心与 Tom 定制拨号组件，默认开启 USB 扫描。网络面板保持 `auto` 共享模式；QModem 占用 AT 端口时不要强制切换为独立串口模式。依赖与扫描修复见[兼容性说明](docs/COMPATIBILITY.md)。

### 光影猫管理

打开 **系统 → 光影猫管理**，或点击右上角电量状态，查看电量、供电、电压和主板温度；详情默认展开。选择模式、填写参数，再保存并确认即可。当前官方接口未提供独立的电池温度读数。

| 模式 | 使用方式 |
| --- | --- |
| 手动 | 关闭 UPS 与定时计划，全新安装默认使用此模式 |
| 车载 / UPS | 设置断电后延时 1～600 分钟关机；需由接通充电器自动开机后才启用倒计时，恢复供电取消倒计时，按键手动开机不启用 |
| 每日定时 | 设置每天的开机、关机时间；先确认设备时区和时间正确，修改时区后重启再设置 |

查看页面不会更改策略，保存会替换原计划。保留旧配置时可能沿用已有电源计划，请先核对页面显示的当前模式。

一代电量为电压估算，“外部供电”不等于电池正在充电。充电状态请结合机身充电灯判断：呼吸为充电中，常亮为充电完成；当前未提供独立充电开关。

**电源控制仍为实验性功能**，自动关机会中断供网，真实断电与定时唤醒尚需设备验证。首次测试请确保可以重新接入设备；实现与限制见[电源服务说明](package/swrt-pcat-manager/README.md)。

与当前官方系统的源码差异及验证范围见[官方源码对照](docs/OFFICIAL-SOURCE-COMPARISON.md)；v1.8 已真机启动并验证三种模式的保存与读回，完整自动关机／唤醒周期仍待验收。

### 多 WAN 故障切换

默认优先顺序为：

```text
有线 WAN → Wi-Fi 中继 → 蜂窝网络
```

Wi-Fi 中继需自行配置，QModem 的 IPv4 拨号接口首次上线会加入 MWAN3。删除模组后请清理旧成员；PassWall 与 OpenClash 避免同时接管相同流量。

**软、硬件流量卸载默认均开启。** 实际硬件转发取决于驱动和数据路径，不能只看界面开关；说明与检查方法见[RK3568 流量卸载研究](docs/OFFLOADING-RK3568.md)。

### iStore 与 Docker

首页网络面板磁贴使用蓝白图标，手机端保留左右滑动。终端入口在 **系统 → 终端**，显示 BusyBox、SWRT 字符画与作者署名。

软件源默认使用南京大学 ImmortalWrt 镜像，iStore 兼容源独立保留。出现“软件源错误”时检查网络与软件源；首页会保留真实的连接失败提示。不要混装其他固件的 IPK 或内核驱动，详见[兼容性说明](docs/COMPATIBILITY.md)。

Docker / Compose 已集成，管理入口在左侧独立的 **Docker** 菜单。保留 iStore 容器应用使用的 Lua 接口，兼容原来的“服务 → Dockerman”链接。

根分区为 1 GiB。全新 SquashFS 安装默认使用原生 `/overlay/docker`；已有容器数据和自定义目录不会自动迁移。大型 iStore 容器应用可能超过可用空间，应先在 Docker 配置中选择稳定的独立 ext4 存储；配置备份不包含镜像、容器和数据卷。DiskMan 入口为 **系统 → 磁盘管理**，分区、格式化前先备份。排查范围和限制见 [Docker 兼容性说明](docs/DOCKER-COMPATIBILITY.md)。

## 自动构建

### 手动触发

1. 打开 [Actions](https://github.com/SlAlot/ImmortalWrt_Photonicat1/actions/workflows/swrt.yml)。
2. 选择 **Build SWRT Photonicat1**。
3. 点击 **Run workflow**，选择 `main` 分支并运行。

需要先验证、不公开发布时，关闭 `publish_release`，编译结果仍会保存在 Actions 附件中。

版本输入框留空时自动递增；需要指定版本时填写 `1.5` 这样的版本号，必须高于已有发布（含草稿）。

### 推送触发

向 `main` 推送构建配置、预置文件、软件包、脚本、测试或工作流变更时自动构建。仅修改 README 或文档不会触发完整固件编译。Pull Request 运行检查任务。

`main` 分支构建成功后自动发布到 Releases。依赖解析、必需插件检查、编译或镜像验证失败时，不发布该次固件。

发布版本根据仓库中已有的 `v<版本号>` Release 自动递增。仅整理命名与发布文件时，维护提交可加 `[skip firmware]` 跳过完整编译，脚本与集成检查仍照常运行；手动运行工作流仍执行完整构建。

### 修改配置与依赖

- 在 [`.config`](.config) 中调整构建选项。
- 在 [`files/`](files/) 中维护固件预置文件。
- 源码与 feeds 使用固定提交，版本记录在 [`sources.lock.json`](sources.lock.json)；更新 feeds 时同步修改 [`feeds.conf.default`](feeds.conf.default)。
- 网络面板使用作者正式发布的 ARM64 musl 程序，经固定 SHA-256 校验后封装为系统原生软件包。更新时同步修改锁文件及 [软件包定义](package/wlmb-server/Makefile) 中的版本与摘要。
- 安装清单、最终配置、镜像检查报告和日志保存在 Actions 的 `SWRT-build-diagnostics-<构建编号>` 附件中，保留 7 天。

## 项目结构

```text
.
├── .github/workflows/swrt.yml  # 自动检查、编译与发布
├── .config                    # 固件构建配置
├── feeds.conf.default         # feeds 与固定提交
├── sources.lock.json          # 源码与依赖版本记录
├── diy.sh                     # 编译前自定义命令
├── files/                     # 固件预置文件
├── package/                   # 网络面板、在线更新与电源管理
├── scripts/                   # 配置检查与镜像验证脚本
├── tests/                     # 构建集成测试
└── docs/                      # 兼容性与发布说明
```

## 已知问题与兼容性

- **依赖与上游审查**：当前限制见[兼容性说明](docs/COMPATIBILITY.md)；历史记录见 [2026-10-22 检查报告](docs/AUDIT-2026-10-22.md)。
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
