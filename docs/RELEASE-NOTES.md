## SWRT · 光影猫一代 v2.0

适用于 **Photonicat 1 / RK3568**，支持 **1+8、2+16、4+64 GB**，不适用于二代。作者：**SlAlot**。

### 版本内容

- 内置更新器 **1.1.1**，修复确认升级后重启仍停在原版本的问题，完善升级异常提示。
- eMMC 首次开机自动扩容，后续升级保留已扩容的分区边界。
- 集成 QModem Next（Tom 核心）、网络面板、iStore 首页与商店、Docker / Compose、DiskMan、ttyd 和光影猫管理。
- 包含 QCA9377、WCN6855、MT7603、MT76x2、MT7921 / MT7922 无线驱动及常用 USB 驱动，软、硬件流量卸载默认开启。

默认管理地址 **192.168.17.1**，账号 **root**，初始密码为空；主机名 **S-Photonicat1**。

### 下载与安装

| 文件 | 内容 |
| --- | --- |
| `immortalwrt-photonicat-1-squashfs-sysupgrade-2.0.img.gz` | SquashFS 固件 |
| `immortalwrt-photonicat-1-ext4-sysupgrade-2.0.img.gz` | ext4 固件 |
| `sha256sums` | SHA-256 校验清单 |

**v1.9 及更早版本升级：**先备份，在“系统 → 备份与升级”上传同类型 `.img.gz`，无需解压，建议不保留配置。不要使用旧 SWRT 在线更新器重试；进入 v2.0 后，后续再使用在线更新。

**首次安装或跨系统切换：**将 `.img.gz` 解压成 `.img`，使用 RKDevTool 和一代 Loader，完整镜像写入地址为 `0x00000000`。首次开机自动扩容可能额外重启一次，请保持供电并等待完成。

配置备份不包含 Docker 镜像、容器和数据卷，重要数据另行备份。完整步骤与网卡列表见 [README](https://github.com/SlAlot/ImmortalWrt_Photonicat1#下载与安装)。
