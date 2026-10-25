## SWRT · 光影猫一代 v1.8

适用于 **Photonicat 1 / RK3568**，不适用于二代。

### 本次更新

- 恢复独立 Docker 菜单并保留旧链接，内置 iStore 容器应用依赖的 Lua Docker 库与任务组件。
- 修正默认 WAN 规则误拦容器回包的问题，避免 Docker 主动将路由器转发默认策略改为丢弃；保留已有防火墙自定义项与流量卸载设置。
- 补齐 Docker 容器日志解码和换行显示，构建与发布前检查容器运行时及 iStore 依赖是否完整。
- 辅助 5V 电源增加开机保持属性，避免 regulator 初始化时主动拉低使能 GPIO；运行时继续由原 USB 电源策略控制。
- 检查三层内核配置及最终编译出的内核，拦截与裸串口后台冲突的 MCU 驱动，并确认 UART 驱动为内建。
- 服务启动时发现官方内核 MCU 控制接口，会停止启动并记录原因，避免重复占用串口。
- 补齐旧管理器名称的冲突检查，并将最终内核配置和电源检查结果保存到 Actions 诊断附件。
- 更新官方源码对照与使用说明；本地 36 项相关 Linux 测试、设备树编译及 Shell 检查通过，完整构建与镜像检查以本次 Actions 结果为准。

**本版尚未确认解决实际不充电或拔掉充电线后关机的问题，充电、断电接管及 USB / SD 长期稳定性仍待真机验证。** 电量为电压估算，一代目前没有独立充电开关。详见[官方源码对照](https://github.com/SlAlot/ImmortalWrt_Photonicat1/blob/main/docs/OFFICIAL-SOURCE-COMPARISON.md)。

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
