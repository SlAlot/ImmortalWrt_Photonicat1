## SWRT · 光影猫一代 v1.8

适用于 **Photonicat 1 / RK3568**，不适用于二代。

### 本次更新

- 恢复独立 Docker 菜单并保留旧链接，内置 iStore 容器应用依赖的 Lua Docker 库与任务组件。
- 修正默认 WAN 规则误拦容器回包的问题，避免 Docker 主动将路由器转发默认策略改为丢弃；保留已有防火墙自定义项与流量卸载设置。
- 补齐 Docker 容器日志解码和换行显示，构建与发布前检查容器运行时及 iStore 依赖是否完整。
- 复查补齐旧 Docker 入口跳转，修正 Lua 分段 JSON / 日志解析和服务未启动时的错误返回，完善 JS 后端响应头拼接及完整请求写入。
- 修复 Lua 兼容库的构建发现声明；配置与成品检查拒绝第二套旧 Docker 启动插件。
- 电源方案改为官方内核驱动、对应一代设备树与内核接口后台，统一心跳、看门狗和关机握手。
- 默认电压参数与现场官方系统对齐，全部保留 MCU 默认值；旧版未改过的出厂配置迁移时保留备份，自定义配置不覆盖。
- 构建和成品检查要求内建配套电源驱动；保留光影猫管理界面与 QModem，禁止旧裸 UART 后台重复控制。
- Docker 29.6.1 / Compose 5.1.4、iStore Lua 接口及 ucode RPC 已在 RK3568 官方系统的隔离环境运行验证，并实测确认存储与 WAN 回包修复。完整固件及商店实际应用的验收范围见 [Docker 说明](https://github.com/SlAlot/ImmortalWrt_Photonicat1/blob/main/docs/DOCKER-COMPATIBILITY.md)。构建与镜像检查以本次 Actions 结果为准。

**当前为待验收的电源方案验证构建，尚未确认解决实际不充电或拔线关机问题，不自动发布。**
启动新内核后需实测充电、拔线接管、关机与唤醒。详见[官方电源对照](https://github.com/SlAlot/ImmortalWrt_Photonicat1/blob/main/docs/OFFICIAL-SOURCE-COMPARISON.md)。

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
