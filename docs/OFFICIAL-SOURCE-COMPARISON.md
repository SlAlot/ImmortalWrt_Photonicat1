# 官方 OpenWrt 源码对照

核对日期：2026-10-25。对象：光影猫一代 / RK3568。
本记录和新增补丁完成于 v1.7 发布之后，纳入 v1.8 源码。ARM 固件构建与附件校验以对应 Actions 结果为准；**实际充电故障未确认解决，尚未刷写本次修正做真机验证**。

## 仓库身份与公开范围

[官网源码入口](https://photonicat.com/downloads)直接链接到
[photonicat/photonicat_openwrt](https://github.com/photonicat/photonicat_openwrt)。
其 `master` 同时支持一代和二代；本次固定检查提交
`119964435eb7bc6384eed8ecee7bd7104b6e8ee2`，源码归档 SHA256 为
`6303d9707ab7f7be3b30f05878928b118ce7489983092b8fb4c1cc39d1df0464`。

这是官方 OpenWrt 构建树，但目前不能视为所有组件均可匿名取得、能完整复现现用镜像的一套源码：

| 部分 | 本次确认 |
| --- | --- |
| 构建系统、一代设备树、内核电源驱动 | GitHub 公开，可以逐项检查 |
| 一代配置 | `configs/photonicat_base_defconfig` 指定 `photonicatWrt 26.10.0`，与此前真机系统名称、版本及芯片系列相符 |
| 新版 `pcat-manager` | 公开的[构建配方](https://github.com/photonicat/photonicat_openwrt/blob/119964435eb7bc6384eed8ecee7bd7104b6e8ee2/package/pcat/pcat-manager/Makefile)为 `2.0.0-r64`，实现源码指向 `git.g77k.com/supercatexpert/pcat-manager.git` 的 SSH 地址。匿名网页访问跳到登录页，Git 拉取入口返回 HTTP 401 |
| 管理器另一个公开分支 | [公开 master](https://github.com/photonicat/rockchip_rk3568_pcat_manager/tree/0e61a4abf35c423420310311f1b2b059deba0cac)包含新版 serdev、sysfs 与充电上限代码，但 README 明确面向二代、要求一代使用 v1。其提交为 `0e61a4a`，不是生产配方指定的 `800104f`；后者在该 GitHub 仓库也检索不到。因此不能说所有新版代码都未公开，但仍缺少可对应现用一代镜像的完整修订 |
| `pcat-manager-web` | 公开的[配方](https://github.com/photonicat/photonicat_openwrt/blob/119964435eb7bc6384eed8ecee7bd7104b6e8ee2/package/pcat/pcat-manager-web/Makefile)也引用另一处 SSH 源码，匿名网页访问需要登录；这个构建树不包含其完整实现 |
| 现用官方镜像 | 此前真机报告 `r7921-4526447cab`、`pcat-manager 2.0.0-r65`。在本 GitHub 仓库检索不到该构建提交，公开配方的 release 也不同，不能宣称与现用镜像逐字一致 |
| 其他依赖 | feeds 跟踪分支而非完整提交锁；部分固件以二进制提供。本仓库没有包含板载 MCU 的完整实现，不能仅凭主仓库公开判断全部系统已公开 |

## 电源实现的实际区别

当前官方构建使用
[`990-photonicat-pm-add-driver.patch`](https://github.com/photonicat/photonicat_openwrt/blob/119964435eb7bc6384eed8ecee7bd7104b6e8ee2/target/linux/rockchip/patches-6.12/990-photonicat-pm-add-driver.patch)
和内建 `CONFIG_PHOTONICAT_PM=y`。内核通过 serdev 管理 UART4，对用户态提供
`/dev/pcat-pm-ctl` 和 power_supply / RTC 接口；此前真机也读到了这些设备。
SWRT 使用公开旧 v1 电源代码，直接管理 `/dev/ttyS4`，不是当前官方新版后台。

两套接口不能通过替换一个设备路径来混用：内核过滤心跳、状态应答、看门狗等命令，并重写转发帧序号。
直接改路径或同时加载两套管理器会破坏旧后台的确认和关机逻辑。此次没有迁移 MCU 后端或引入需认证获取的代码。
官方公开驱动的默认看门狗为 10 秒、由内核维护；旧 v1 后台为 5 秒、由用户态维护。
这是服务架构差异，不能单凭这个差异认定已经找到充电故障根因。

另外检查了上述公开 master 的 `src/pmu-manager.c`：它读取 sysfs 电量，通过 `/dev/pcat-pm-ctl` 发扩展命令，
初始化时会查询二代充电上限、电池详细信息等。一代现用 MCU 没有这些扩展；不能把二代整个初始化流程替换进来。
这份公开分支的源码归档 SHA256 为 `9ea7890bba5a36d52104e9fa873c29dc7389303f3092d8b7bf6d42d720017b63`。

公开驱动对一代短状态帧仍按输入是否达到 4.2V 推算外部供电，电量按电压曲线估算，
没有找到独立的一代充电开关。没有借用二代充电上限命令，也没有调整充电电压、满电阈值、温度或低电压保护来绕过故障。

## 已修正的辅助供电差异

官方[一代设备树](https://github.com/photonicat/photonicat_openwrt/blob/119964435eb7bc6384eed8ecee7bd7104b6e8ee2/target/linux/rockchip/files/arch/arm64/boot/dts/rockchip/rk3568-photonicat.dts)
通过 `aux-pwren` gpio-hog 保持 `GPIO4_D2` 高电平；此前真机设备树也有同样节点。
ImmortalWrt 则把同一 GPIO 交给 `vcc5v0_boost` regulator，通过 USB PHY 作为消费者开启。
v1.7 实际镜像里的该 regulator 没有 `regulator-boot-on` / `regulator-always-on`。

Linux 6.12 的[固定 regulator 驱动](https://github.com/torvalds/linux/blob/v6.12/drivers/regulator/fixed.c)
在未声明 boot-on 时以 `GPIOD_OUT_LOW` 申请使能 GPIO。存在初始化先拉低、后续再打开的风险；
缺少消费者时也可能被关闭。这是外设辅助供电连续性的差异，**不是已证实的电池充电故障原因**。

首次拟增加 boot-on 与 always-on。再次复核 Linux 的
[regulator 核心](https://github.com/torvalds/linux/blob/v6.12/drivers/regulator/core.c)后发现，always-on 会持续持有
`vin-supply` 指向的上级 USB 电源引用，不能把它等同于官方独立 GPIO 的保持行为，可能改变运行时关断与恢复路径。
因此已移除尚未发布的 always-on 改动，只修正有明确源码依据的启动初始化问题。

最终 `patches/rockchip/950-swrt-photonicat-keep-aux-power.patch` 仅对现有 regulator 增加：

```dts
regulator-boot-on;
```

保持原来的 GPIO、USB PHY 绑定和上游电源依赖，不增加第二个 gpio-hog。
运行期间仍由原 USB 消费者管理开启与关闭，没有消费者时允许正常关断；没有宣称完全复刻官方持续置高的运行策略。
是否改善启动或拔线后的外设稳定性仍需真机验证。

`scripts/patch-board-power.py` 在构建前核对锁定设备补丁的 SHA256，拒绝未知版本和同名不同内容的本地补丁；
检查 generic、rockchip 与 armv8 三层配置；检测到内建或模块化 `CONFIG_PHOTONICAT_PM` 时停止，避免包检查漏掉内核所有者。
检查在 `diy.sh` 之后执行，防止自定义步骤绕过；发布附件收集时还通过 `check-kernel-power.py` 核对最终编译内核的配置，
拒绝第二个 MCU 所有者、缺失或模块化的 UART 驱动、缺失或歧义的内核构建目录，并把最终配置保存到诊断附件。
运行时若 `/dev/pcat-pm-ctl` 已存在，裸串口后台拒绝启动并记录原因。
同时补充排除官方旧名称 `pcat-manager-v1`，并生成 `swrt-metadata/board-power.json` 供构建附件核对。

## 没有直接套用的改动

- [eMMC 降到 52MHz 的提交](https://github.com/photonicat/photonicat_openwrt/commit/873643193f8105e92e3a33cddc4377c94d09846c)实际修改 RK3576 二代设备树及 U-Boot，一代不受这条提交影响。
- 公开一代设备树把电池设计最小电压写为 4.10V、最大写为 3.45V，数值顺序异常；此前真机读到的则是最小 3.56V、最大 4.10V。这些属性不是可直接下发的充电电压，未复制到 SWRT。
- 官方内核的 USB watchdog 驱动不代表一代一定启用了对应设备节点。本次没有添加自动重置 USB Hub 的机制，避免写盘过程中复位整条 USB 链路。
- 没有替换官方整套设备树、网口编号、PHY 配置、用户界面、软件源或 QModem；软、硬件流量卸载继续默认开启。

## 验证范围

- 在 Linux 用 GNU patch `--fuzz=0` 实际应用新增补丁，与预期源码逐字比较通过。
- 下载并核对 v1.7 SquashFS 镜像 SHA256，从启动分区提取实际设备树。再次 DTC 检查确认仅增加 boot-on，逐节点比较确认其余属性、GPIO、phandle 和所有供电引用保持原值；完整锁定设备树源码应用补丁后与预期逐字比较通过。这是设备树层面的验证，不是整套 ARM 内核重新编译。
- 再次复核后的 36 项 Linux 针对性测试全部通过：板级防护及 DTC 7 项、最终内核配置 5 项、构建准备 6 项、成品与网络集成 12 项、服务和存储保护 6 项。Shell 语法与 shellcheck 通过。Windows 完整发现 88 项，其中 40 项执行通过、48 项因原生环境要求跳过；未把跳过项计为通过。
- 未写入当前官方系统，未刷写固件或下发电源控制命令。检查时 SSH 不可达、ADB 无设备，充电、拔线接管及 USB / SD 长期稳定性仍待真机验收。
