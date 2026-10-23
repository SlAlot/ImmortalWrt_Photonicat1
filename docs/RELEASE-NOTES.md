## SWRT · 光影猫一代固件

适用于 **Photonicat 1 / RK3568**，不适用于二代。

### 本次更新

- **SWRT 在线更新**：系统 → SWRT 在线更新，自动匹配同类型固件，下载、校验后手动确认；默认不保留配置，刷写请求失联后等待重连，不重复发送。
- **光影猫一代管理**：系统 → 光影猫一代管理，提供电池详情、车载 / UPS 延时关机与每日定时开关机。全新安装默认手动模式，电源控制仍为实验性功能。
- **DiskMan**：系统 → 磁盘管理，提供分区、SMART 与文件系统工具。
- 统一新页面与确认弹窗的网络面板样式，适配手机、桌面和深浅色；修复服务失联后的页面恢复、旧状态提示及 Argon 标题样式干扰。
- 精简 README，补齐旧版升级、新功能使用与验证范围。

继续集成 QModem Next（Tom 核心）、网络面板、iStore、Docker / Compose、MT7921/MT7922 等无线与 USB 驱动；首页磁贴保留蓝白图标和手机左右滑动。软件与硬件流量卸载默认均开启。

默认主机名 `S-Photonicat1`，网关 `192.168.17.1`，终端 Banner `SWRT`，软件源使用南京大学 ImmortalWrt 镜像及独立 iStore 兼容源。

### 下载

- `immortalwrt-photonicat-1-squashfs-sysupgrade-<版本号>.img.gz`：SquashFS 完整镜像。
- `immortalwrt-photonicat-1-ext4-sysupgrade-<版本号>.img.gz`：ext4 完整镜像。
- `sha256sums`：固件 SHA-256 校验清单。

选择一种镜像即可；GitHub 自动显示的 “Source code” 是源码，不能用于刷机。配置、软件包清单、验证报告与日志请到对应 [Actions 构建](https://github.com/SlAlot/ImmortalWrt_Photonicat1/actions/workflows/swrt.yml) 下载诊断附件（保留 7 天）。

从未集成 SWRT 在线更新的旧版本升级：进入 **系统 → 备份 / 升级**，上传与当前系统类型相同的 `.img.gz`，推荐不保留配置。此次安装后才能使用新的在线更新入口。

**USB 线刷必须先将 `.img.gz` 解压为 `.img`，整盘写入地址为 `0x00000000`，不要直接刷 `.gz`。** 使用光影猫一代对应的 Loader，操作见[官方刷机教程](https://photonicat.com/wiki/Photonicat_刷机操作手册)。

详细步骤见[项目 README](https://github.com/SlAlot/ImmortalWrt_Photonicat1#readme)。发布前执行构建与镜像检查，实际启动、拨号、刷写及电源动作仍需真机验证，详见[兼容性与验证范围](https://github.com/SlAlot/ImmortalWrt_Photonicat1/blob/main/docs/COMPATIBILITY.md)。
