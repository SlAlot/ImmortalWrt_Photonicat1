## SWRT · 光影猫一代 v1.8

适用于 **Photonicat 1 / RK3568**，不适用于二代。

### 本次更新

- 电源管理采用官方内核驱动与配套一代设备树，统一心跳、看门狗、RTC 和关机握手；电压参数保留 MCU 默认值，旧出厂配置迁移前备份，自定义配置不覆盖。
- 修复每日定时开机的时区转换，避免北京时间相差 8 小时；修正电源管理与在线更新的 RPC 数字参数，一代未提供电池温度时显示“未提供”。
- 在线更新默认使用 `gh-proxy.com` 国内加速，可切换 GitHub 官方源并自动保存；版本查询、校验清单和固件下载统一走所选源，切换后重新检查并校验。
- 修复 Docker 独立侧栏入口、iStore 容器应用依赖、WAN 回包规则及日志兼容；完善构建检查，软件与硬件流量卸载继续默认开启。

保留 QModem Next（Tom 核心）、网络面板、iStore、Docker / Compose、DiskMan、MT7921/MT7922 等无线与 USB 驱动；首页保留蓝白网络面板图标及手机左右滑动。

默认主机名 `S-Photonicat1`，网关 `192.168.17.1`，终端 Banner `SWRT`。

### 下载与更新

仅发布三个附件：

- `immortalwrt-photonicat-1-squashfs-sysupgrade-1.8.img.gz`
- `immortalwrt-photonicat-1-ext4-sysupgrade-1.8.img.gz`
- `sha256sums`

选择一种镜像即可；GitHub 自动显示的 “Source code” 是源码，不能刷机。

**已安装 SWRT：**先备份配置，选择与当前系统相同的 SquashFS / ext4 类型。可使用“系统 → SWRT 在线更新”，或在“系统 → 备份与升级”直接上传 `.img.gz`，推荐不保留配置。已安装早期 v1.8 验证固件时，使用网页手动上传本次正式镜像；在线更新不会覆盖相同版本。

**首次安装或从其他系统切换：**使用 RKDevTool USB 线刷，**先将 `.img.gz` 解压成 `.img`**，使用一代 Loader，整盘镜像地址为 `0x00000000`。不要把压缩包直接刷入。步骤见[项目 README](https://github.com/SlAlot/ImmortalWrt_Photonicat1#下载与安装)及[官方教程](https://photonicat.com/wiki/Photonicat_刷机操作手册)。

### 验证范围

新电源内核已真机启动，用户基础测试反馈正常；三种电源模式的保存、读回及互斥切换，以及两种更新源的版本查询、校验清单和固件数据读取均已验证。电源与更新组件共 37 项原生回归通过；正式固件的完整构建与镜像检查以本次 Actions 为准。

完整充电观察、车载断电倒计时和关机／定时唤醒周期仍待验收；Docker 在隔离环境完成运行时与兼容性验证，尚不能保证全部商店应用均已实测。详情见[电源记录](https://github.com/SlAlot/ImmortalWrt_Photonicat1/blob/main/docs/POWER-INVESTIGATION.md)及[Docker 说明](https://github.com/SlAlot/ImmortalWrt_Photonicat1/blob/main/docs/DOCKER-COMPATIBILITY.md)。构建日志和软件包清单保留在对应 Actions 的诊断附件中。
