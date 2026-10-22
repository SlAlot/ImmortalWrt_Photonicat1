## SWRT · 光影猫一代固件

适用于 **光影猫一代（Photonicat 1 / RK3568）**，基于 ImmortalWrt `openwrt-25.12` 构建，不适用于二代设备。

### 集成功能

- **蜂窝拨号**：`luci-app-qmodem-next` 界面、Tom AT 核心（启用 ubus 共享支持）和 Tom 定制 Quectel CM 拨号组件。
- **网络面板**：SlAlot 的 `wlmb-server`，默认使用 `auto` 模式识别共享通道。
- **管理首页与商店**：iStore QuickStart 首页、iStore 应用商店及所需后端和 Lua 兼容组件。
- **容器管理**：Docker、Docker Compose、LuCI Docker 管理界面。
- **网络与设备管理**：保留 PassWall、OpenClash、MWAN3、SmartDNS、ZeroTier、无线及光影猫电源管理。
- **驱动**：通用 USB QMI、MBIM、NCM、ECM、RNDIS、串口、PCIe MHI 和 USB 存储支持。

移除原有锁频与短信界面；禁用依赖旧版 QModem 主界面的 SMS、MWAN、TTL、HC 插件。保留 Next 所需的短信后端、转发组件与核心命令行工具。

### 默认配置

| 项目 | 默认值 |
| --- | --- |
| 设备主机名 | `S-Photonicat1` |
| LAN 地址 / 网关 | `192.168.17.1/24` |
| 终端 Banner | `SWRT` |
| 管理页面 | `http://192.168.17.1` |
| 网络面板 | `http://192.168.17.1:1117` |
| 软件包格式 | APK |
| 根分区大小 | 1 GiB |

### 下载文件

| 文件名特征 | 用途 |
| --- | --- |
| `*-squashfs-sysupgrade.img.gz` | SquashFS 完整磁盘镜像 |
| `*-ext4-sysupgrade.img.gz` | ext4 完整磁盘镜像 |
| `sha256sums` | 发布附件的 SHA-256 校验清单 |
| `*.manifest` | 固件实际安装的软件包及版本清单 |
| `config.resolved` | 最终解析的构建配置 |
| `image-validation.json` | 镜像校验和、解压大小及引导结构检查结果 |
| `FLASHING-README.md` / `COMPATIBILITY.md` | 安装与兼容性说明 |

选择一种文件系统的固件即可。GitHub 自动生成的 “Source code” 压缩包是项目源码，不能用于刷机。`profiles.json` 中的 `default_packages` 不是完整安装清单，核对插件请查看 `.manifest`。

### USB 线刷

**必须先将 `.img.gz` 解压为 `.img`，RKDevTool 中选择解压后的完整镜像，整盘写入地址为 `0x00000000`。不要直接刷入 `.gz` 文件。**

按[光影猫官方刷机教程](https://photonicat.com/wiki/Photonicat_刷机操作手册)的主线内核方式操作，并使用光影猫一代对应的 `MiniLoaderAll.bin`。该文件供刷机工具初始化设备使用，需按官方教程另行获取；本 Release 不附带刷机工具或该独立 Loader 文件。

### 使用说明

- 首次通过 LAN 网口连接，登录后修改管理密码与无线密码，并按运营商要求配置 APN。
- QModem 占用 AT 端口时，网络面板保持 `auto` 模式，避免强制独占串口。
- QuickStart 不提供 iStoreOS 固件更新；系统升级使用本项目发布的固件。
- Docker 根分区空间有限，运行较大容器前将数据目录迁移到合适的 ext4 存储。
- 已检查必需包、冲突包、镜像校验和与引导头；设备启动、拨号、首页和容器运行仍需实机验证。
