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
| 应用商店 | iStore |
| 容器 | Docker、Docker Compose 与 LuCI Docker 管理 |
| 多 WAN | MWAN3，有线 WAN、Wi-Fi 中继与蜂窝链路故障切换 |
| 网络工具 | PassWall、OpenClash、SmartDNS、ZeroTier |
| 设备管理 | CPU 调频、电池状态与光影猫电源管理 |
| 驱动 | 板载/扩展无线、MT7921/MT7922、USB 2/3、蜂窝串口与数据接口、USB 存储/UAS、ext4 |

蜂窝接口包含通用 QMI、MBIM、NCM、ECM、RNDIS、ACM/WDM 与 PCIe MHI 支持。实际可用协议取决于模组型号、固件与连接方式。

MT7921/MT7922 的 PCIe 支持共用 `mt7921e`，并包含两种芯片的 Wi-Fi 固件；另包含 MT7921 系列 USB/SDIO 驱动。USB 支持不代表任意 USB 网卡均适用，仍取决于具体芯片与设备 ID。蓝牙不在此次 Wi-Fi 驱动范围内。原有 QCNFA765 / WCN6855 与板载无线支持继续保留；更换网卡后按实际无线设备重新配置。

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

在 [Releases](https://github.com/SlAlot/ImmortalWrt_Photonicat1/releases) 中选择构建成功的版本，根据需求下载以下镜像：

| 文件名特征 | 内容 |
| --- | --- |
| `immortalwrt-photonicat-1-squashfs-sysupgrade-<版本号>.img.gz` | SquashFS 完整镜像 |
| `immortalwrt-photonicat-1-ext4-sysupgrade-<版本号>.img.gz` | ext4 完整镜像 |
| `sha256sums` | 发布文件的 SHA-256 校验清单 |

版本号从 `1.0` 开始，依次为 `1.1`、`1.2`，到 `1.9` 后递增为 `2.0`。Release 仅保留上述三个附件，下载后使用 `sha256sums` 校对文件完整性。GitHub 自动显示的 “Source code” 是项目源码，不能用于刷机。

实际安装的软件包清单、最终构建配置、源码与 feeds 版本、镜像检查报告和日志保存在对应 Actions 构建的 `SWRT-build-diagnostics-<构建编号>` 附件中，保留 7 天。

### USB 线刷

按 [光影猫官方刷机教程](https://photonicat.com/wiki/Photonicat_刷机操作手册)的主线内核方式操作：

1. 备份需要保留的配置与数据。
2. **将 `.img.gz` 解压为 `.img`。RKDevTool 中选择解压后的 `.img`，不要直接刷入 `.gz` 文件。**
3. 使设备进入 MaskROM 模式，并连接刷机电脑。
4. 在 RKDevTool 的“下载镜像”页，选择光影猫一代对应的 `MiniLoaderAll.bin` 与完整 `.img`；整盘镜像写入地址为 `0x00000000`。
5. 按官方教程完成写入与重启，等待设备初始化。
6. 通过 LAN 网口连接设备，打开 [管理页面](http://192.168.17.1)。

跨系统安装按官方教程处理擦除操作；擦除会清除数据。首次安装完成后逐项配置，避免整套恢复旧网络配置覆盖当前默认设置。

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

首页加入网络面板快捷磁贴，点击进入 LuCI → 服务 → 网络面板，Logo 跟随 Argon 明暗模式。终端入口在 **系统 → 终端**，登录后显示 SWRT 字符画，下方标注作者 `SlAlot` 和 `ImmortalWrt`。

QuickStart 0.13.0 会额外请求 `packages.adb.asc`，ImmortalWrt 源没有此文件。本项目改为检测当前 APK 配置中的 base 索引 `packages.adb`（最多缓存 60 秒）；真实的网络、DNS、源连接失败仍显示错误。“软件源配置”进入系统软件包管理页，避免旧向导将 ImmortalWrt 源替换成 OpenWrt 源。索引可达不代表所有自定义包均有在线更新；内核模块仍须匹配本固件构建版本。

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
- **首页兼容性**：QuickStart 部分组件可能受到主题样式、浏览器缓存或平台温度/存储接口影响，详见 [兼容性说明](docs/COMPATIBILITY.md)。
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
