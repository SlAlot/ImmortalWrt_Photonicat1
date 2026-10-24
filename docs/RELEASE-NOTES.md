## SWRT · 光影猫一代 v1.7

适用于 **Photonicat 1 / RK3568**，不适用于二代。

### 本次更新

- 电量状态改为“外部供电 / 电池供电”，不再把接电误报成正在充电；光影猫管理增加输入电压提示。
- 恢复官方按模组选择低电压保护和电量曲线的逻辑，只读识别 USB 设备，不占用 QModem AT 端口。
- 过期、无效电源数据或串口断线不触发 UPS 自动关机；重连后重新确认外部供电。
- 缩短电源后台异常退出后的恢复等待，保留官方看门狗和硬件保护；增加供电变化、MCU 关机原因日志及管理器冲突检查。
- 全新 SquashFS 安装将 Docker 默认数据放到原生 `/overlay/docker`，避免容器存储叠加在根 OverlayFS 上；已有容器数据和自定义目录不自动迁移。
- 更新使用说明与验证记录；本地 73 项 Linux 回归、两个前端行为测试及 Shell 检查通过。

**本版尚未确认解决实际不充电或拔掉充电线后关机的问题，充电、断电接管及 USB / SD 长期稳定性仍待真机验证。** 电量为电压估算，一代目前没有独立充电开关。详见[电源核对记录](https://github.com/SlAlot/ImmortalWrt_Photonicat1/blob/main/docs/POWER-INVESTIGATION.md)。

继续集成 QModem Next（Tom 核心）、网络面板、iStore、Docker / Compose、DiskMan、MT7921/MT7922 等无线与 USB 驱动；首页磁贴保留蓝白图标和手机左右滑动。软件与硬件流量卸载默认均开启。

默认主机名 `S-Photonicat1`，网关 `192.168.17.1`，终端 Banner `SWRT`，软件源使用南京大学 ImmortalWrt 镜像及独立 iStore 兼容源。

### 下载

- `immortalwrt-photonicat-1-squashfs-sysupgrade-<版本号>.img.gz`：SquashFS 完整镜像。
- `immortalwrt-photonicat-1-ext4-sysupgrade-<版本号>.img.gz`：ext4 完整镜像。
- `sha256sums`：固件 SHA-256 校验清单。

选择一种镜像即可；GitHub 自动显示的 “Source code” 是源码，不能用于刷机。配置、软件包清单、验证报告与日志请到对应 [Actions 构建](https://github.com/SlAlot/ImmortalWrt_Photonicat1/actions/workflows/swrt.yml) 下载诊断附件（保留 7 天）。

从未集成 SWRT 在线更新的旧版本升级：进入 **系统 → 备份 / 升级**，上传与当前系统类型相同的 `.img.gz`，推荐不保留配置。此次安装后才能使用新的在线更新入口。

**USB 线刷必须先将 `.img.gz` 解压为 `.img`，整盘写入地址为 `0x00000000`，不要直接刷 `.gz`。** 使用光影猫一代对应的 Loader，操作见[官方刷机教程](https://photonicat.com/wiki/Photonicat_刷机操作手册)。

详细步骤见[项目 README](https://github.com/SlAlot/ImmortalWrt_Photonicat1#readme)。发布前执行构建与镜像检查，实际启动、拨号、刷写及电源动作仍需真机验证，详见[兼容性与验证范围](https://github.com/SlAlot/ImmortalWrt_Photonicat1/blob/main/docs/COMPATIBILITY.md)。
