# 光影猫一代电源核对

核对日期：2026-10-25。对象为 RK3568 一代；本文记录源码与文档证据，**不代表实际充电故障已修复或完成断电测试**。

## 官方说明中的三个不同电压

| 电压 | 用途 | 不能据此得出的结论 |
| --- | --- | --- |
| 4.2V | 官方 v1 和 ImmortalWrt Go 服务用于判断外部电源是否在位 | 不能证明电池正在充电 |
| 4.7V | 一代 Web 操作手册说明，输入低于此值会停止充电 | 不是模组低电量关机电压 |
| 4.9V | 一代 Web 操作手册建议的最低充电输入，低于此值充电时间延长 | 高于此值也不能替代充电电流测量 |

以上来自[一代 Web 手册](https://photonicat.com/wiki/Photonicat_WEB_管理页面操作手册)和固定的官方 v1 源码。
页面提示只用于解释读数，不会下发或改写这些阈值。

[使用技巧](https://photonicat.com/wiki/Photonicat_Tips_使用技巧)还说明电池充电温度范围为 0～45℃，超出时降低电流或停充。
主板、CPU、无线网卡温度都不是电池温度，不能拿这些温度直接判定电池温保，也不能通过关闭保护绕过故障。

[自动关机电压教程](https://photonicat.com/wiki/Photonicat_自动关机电压修改)说明模组直接由电池供电，RM500U 对应 3.6V 低电压保护；
该页明确注明适用旧版本。当前官方新系统的配置不能直接用旧教程覆盖，电量曲线修改也只影响百分比显示。

## ImmortalWrt 上游有没有处理

| 上游处理 | 当前锁定源码的情况 | 与本次故障的关系 |
| --- | --- | --- |
| [USB 电池供电修复 #1534](https://github.com/immortalwrt/immortalwrt/issues/1534)，[修复提交](https://github.com/immortalwrt/immortalwrt/commit/76fc121e8f40c1da7008ccfd04462cc8b9d5e3e2) | 当前 `106-arm64-dts-rockchip-complete-photonicat-dts.patch` 已有 GPIO4_D2 的 `vcc5v0_boost`、依赖电源及 `usb2phy0_otg` 绑定 | 修复的是电池模式下 USB 没有输出；不能直接证明能解决电池不充电或整机关机 |
| [替换旧管理器 #1990](https://github.com/immortalwrt/immortalwrt/issues/1990) | 上游默认 `pcat-mgr` 为 Go 实现，包固定于 `754b4f0b783a44d48d91e2dbd6c1dfca667a3049`；SWRT 已替换为官方 v1 的电源部分 | Go 版本通过电压表估算电量，用输入是否达到 4.2V 显示 `Charging`，不是充电电流检测；讨论中也有未显示 100% 的反馈 |
| [PMU 请求安全关机修复](https://github.com/immortalwrt/immortalwrt/commit/c97322eae5cb8a4bd0bca3de418280b59a3b6717) | 锁定内核包源码已含 `orderly_poweroff(true)`，但一代当前未启用此内核包；使用官方 v1 串口服务，已保留 PMU 关机请求与应答处理 | 这是收到低电或按键关机请求后的安全收尾，不是充电使能补丁 |

源码依据：ImmortalWrt `96f566f4a4d04ab44592314bc0279ba9e7de3de0`，packages feed `d200499b31751dc5c72905f37a747712f009f155`。
USB 当前补丁来自[切换上游设备树的提交](https://github.com/immortalwrt/immortalwrt/commit/3733b4b9e08739f8398908665e13c0123d313fc4)。
不能在同一 GPIO 上同时加官方 `gpio-hog` 与现有 regulator，也不能同时启用内核串口电源驱动和用户态 MCU 服务。

## v1.7 修正

- 用 `external_power` 表示电源来源，`charging: null` 表示一代接口未确认充电；UPS 判断使用供电来源。
- 顶部仅显示“外部供电 / 电池供电”，光影猫管理按实际输入电压显示只读提示，失联时清除旧提示。
- 模组功耗类型不再固定为零；只读 USB sysfs 识别官方 v1 的模组类别，不打开 AT 端口或改变 QModem 状态。
- 保留固定官方 v1 的默认电压保护和估算曲线选择；已有用户配置不强制覆盖。这项修正不等于实际充电故障已解决。
- 首次收到状态、供电来源变化和 MCU 请求关机时记录电压与原因码；不逐帧刷日志，不改变原有应答和关机流程。
- MCU 数据过期、串口关闭或电压读数无效时，不用旧数据启动 UPS 关机；重新连接后需再次读到外部供电才会布防。
- 服务异常退出后的重启等待从 5 秒降为 1 秒，早于官方 5 秒看门狗；看门狗、低电压和温度保护继续保留。持续通信故障仍可能触发硬件保护或复位。
- 编译配置、包冲突和成品清单同时排除旧服务及 `kmod-photonicat-pm`，避免内核与用户态争用 MCU。
- 全新 SquashFS 安装将未使用的 Docker 默认目录放到原生 `/overlay/docker`，避免在根 OverlayFS 上再叠加容器 OverlayFS；已有数据、外置存储和 ext4 根系统保持原路径。

一代官方协议没有独立充电开关，二代的充电上限命令不能作为一代开关使用。

## 本轮验证

- 在隔离的 Alpine Linux / QEMU 环境实际执行 73 项 Python 回归，全部通过，无跳过；包含固定官方后台原生 C 编译、USB 枚举识别、模拟 Socket、UPS 状态机、启停信号、Docker 目录保护、更新校验及 QModem / MWAN 回归。
- 两个前端行为测试、Shell 语法与 shellcheck 检查通过；构建配置核对 84 个必需选项和 26 个排除选项，软、硬件流量卸载默认均保持开启。
- QEMU 的 Python 进程启动较慢，运行测试时设 `SWRT_TEST_PROCESS_TIMEOUT=60`；只延长 QModem 测试程序等待时间，默认 CI 仍为 10 秒，固件的重试次数与等待逻辑未变。
- 本地审查未进行整套 ARM 固件编译、刷写或真实电源动作；发布构建和附件检查以 [Actions](https://github.com/SlAlot/ImmortalWrt_Photonicat1/actions/workflows/swrt.yml) 结果为准。审查时两个网关的 SSH 不可达、ADB 无设备，**实际充电、拔线后电池接管、USB / SD 长期稳定性仍未验证**，不能用模拟测试替代。

Linux 回归命令：`SWRT_TEST_PROCESS_TIMEOUT=60 python3 -m unittest discover -s tests -v`。

后续真机对照需要记录同一硬件下两套系统的板端输入电压、电池电压随时间的变化、供电状态、PMU 关机事件及策略；
比较系统负载、模组省电与 USB 电源状态的差异。保持 MCU/硬件保护，不靠降关机阈值或提高充电电压掩盖问题。

调试日志可用 `logread | grep -E 'SWRT power source|SWRT MCU shutdown'` 查看。
MCU 原因码按官方协议解释，缺少原因字节时记录 `-1`，不能把未收到关机事件直接判断成电池故障。
日志在设备内存中，完整断电后可能丢失，断电对照时应通过 SSH 在电脑端同步保存。
