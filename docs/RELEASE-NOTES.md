## SWRT · 光影猫一代固件

适用于 **Photonicat 1 / RK3568**，不适用于二代。

- QModem Next + Tom AT / ubus + Tom 定制拨号组件。
- SlAlot 网络面板、iStore QuickStart 首页、iStore 商店、Docker / Compose。
- 新增 DiskMan 中文磁盘管理，含分区、SMART 与 Btrfs 等文件系统工具，入口：系统 → 磁盘管理。
- 新增“系统 → SWRT 在线更新”，复用网络面板界面样式，从本仓库正式 Release 下载对应类型的固件，校验通过后手动确认升级；默认不保留配置。
- 保留无线、USB 驱动、PassWall、OpenClash、MWAN3 等原有功能，包含 MT7921/MT7922 驱动与固件。
- 主机名 `S-Photonicat1`，网关 `192.168.17.1`，终端 Banner `SWRT`。
- 修复 QuickStart 首页启动路由与静态资源缓存，加入蓝白 Logo 的网络面板磁贴，保留手机端左右滑动。
- 默认使用南京大学镜像，清理无效在线索引，修复 APK 软件源检测；SSH / Web 终端登录精简为 BusyBox 与 SWRT 字符画。

### 下载

- `immortalwrt-photonicat-1-squashfs-sysupgrade-<版本号>.img.gz`：SquashFS 完整镜像。
- `immortalwrt-photonicat-1-ext4-sysupgrade-<版本号>.img.gz`：ext4 完整镜像。
- `sha256sums`：固件 SHA-256 校验清单。

选择一种镜像即可；GitHub 自动显示的 “Source code” 是源码，不能用于刷机。配置、软件包清单、验证报告与日志请到对应 [Actions 构建](https://github.com/SlAlot/ImmortalWrt_Photonicat1/actions/workflows/swrt.yml) 下载诊断附件（保留 7 天）。

**USB 线刷必须先将 `.img.gz` 解压为 `.img`，整盘写入地址为 `0x00000000`，不要直接刷 `.gz`。** 使用光影猫一代对应的 Loader，操作见[官方刷机教程](https://photonicat.com/wiki/Photonicat_刷机操作手册)。

详细设置见[项目 README](https://github.com/SlAlot/ImmortalWrt_Photonicat1#readme)。固件已通过构建与镜像检查，实际启动、拨号和功能仍需实机验证。

依赖、上游修复与验证范围见[检查报告](https://github.com/SlAlot/ImmortalWrt_Photonicat1/blob/main/docs/AUDIT-2026-10-22.md)。
