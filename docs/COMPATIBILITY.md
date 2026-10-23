# 兼容性与验证范围

适用于当前光影猫一代构建配置。日常使用和刷机步骤见 [README](../README.md)，固定源码版本见 [sources.lock.json](../sources.lock.json)。

## 在线更新

- 入口：系统 → SWRT 在线更新。v1.3 等旧固件需先手动升级到 v1.5，补齐插件与固件版本标识。
- 只使用本仓库正式新版，保持当前 SquashFS / ext4 类型；默认不保留配置。下载、校验、确认刷写分开进行。
- 检查附件身份、大小、SHA256、设备兼容性及分区布局；不支持强制刷写、回刷或在线切换文件系统。
- GitHub 访问失败时可改用 LuCI 手动上传；不会自动切换第三方下载代理。刷写请求后失联时等待设备恢复，不重复提交。
- 分区变化、跨系统安装或无法启动时使用 USB 线刷。软件包和容器数据应单独备份。

实现与测试说明见[在线更新组件](../package/luci-app-swrt-upgrade/README.md)。

## 电源管理

- `swrt-pcat-manager` 是唯一 MCU 管理服务，与旧 `pcat-mgr` / `pcat-manager` 互斥。电量显示从同一服务读取，拨号仍由 QModem 负责。
- 后台使用光影猫官方 v1 固定源码，仅构建电源部分，保留串口协议、心跳、看门狗和正常关机握手。
- 全新安装默认手动模式；保留旧配置可能沿用已有计划。访问页面不会写入策略，保存前需要确认。
- UPS 启用前需接入外部供电。每日计划按设备本地时间执行，保存前核对时区与系统时间；修改时区后需重启再设置。
- 电池数据过期、串口离线或策略被其他会话修改时禁止保存。保存后回读；部分失败时尝试恢复原策略，无法确认会明确提示。
- **电源控制为实验性功能**。本次没有实机执行断电、关机或定时唤醒，模拟通信与编译通过不能代替硬件验证。

实现与限制见[电源服务说明](../package/swrt-pcat-manager/README.md)。

## iStore 首页与商店

- QuickStart 需要后端、Lua 兼容层、任务与存储组件；GNU tar 的 XZ 支持同时需要 `xz-utils` 父选项与 `xz`，配置检查会防止依赖被静默取消。
- 禁止再次压缩上游前端，见 [上游 #76](https://github.com/linkease/nas-packages-luci/issues/76)。首页路由按已安装文件注册，避免开机服务尚未就绪时永久回退到状态页，见 [#87](https://github.com/linkease/nas-packages-luci/issues/87)。
- 网络面板磁贴使用蓝白 Logo，手机保留原生左右滑动，不全局覆盖 QuickStart 卡片布局。升级后如仍显示旧资源，先强制刷新浏览器；语言缓存问题见 [#80](https://github.com/linkease/nas-packages-luci/issues/80)。
- 软件源检查使用实际 `packages.adb`，最多缓存 60 秒；不请求 ImmortalWrt 源没有的 `packages.adb.asc`。任一启用索引连接失败仍报告错误。
- 默认南京大学 ImmortalWrt 镜像与独立 iStore 兼容源；不存在公开二进制索引的构建 feeds 不写入在线源。索引可达不代表每个自定义包都有在线更新。
- iStore 支持 APK，但应用架构、依赖、内核 ABI 仍须匹配。固件更新使用 SWRT 入口或本仓库镜像，不使用 iStoreOS OTA。
- 主题、温度、存储字段仍需设备验证，相关上游问题见 [#91](https://github.com/linkease/nas-packages-luci/issues/91) 和 [#108](https://github.com/linkease/nas-packages-luci/issues/108)。

首页修复细节见 [QuickStart 适配记录](QUICKSTART-ADAPTATION.md)。

## QModem、网络面板与多 WAN

- 仅启用 QModem Next，Tom AT 为默认核心并启用 ubus 共享；拨号组件为 Tom 定制 Quectel CM。排除依赖旧界面的 SMS/MWAN/TTL/HC 插件，保留 Next 的短信后端与转发组件。
- 网络面板保持 `auto` 模式；QModem 占用 AT 端口时不强制切换独立串口。通用 USB/MHI 驱动已集成，可用协议仍取决于模组固件及 USB 组合。
- 固定 QModem 源码中的 `kmod-mhi-wwan` 映射为本内核实际提供的 `kmod-mhi-net`；无关的 WeeChat 虚拟依赖循环通过明确选择 `weechat-minimal` 修复。上下文不匹配时停止构建。
- USB 开机扫描由 procd 托管并等待服务就绪，遵守关闭扫描和禁止自动探测的设置；FM350 的 `Generic` 运营商占位符回退到 COPS 查询。
- MWAN3 只纳入匹配的 QModem IPv4 拨号接口，排除 IPv6 与管理桥，重复事件保留用户配置。删除模组后需手动清理旧成员。
- 软件与硬件流量卸载默认均开启；实际硬件转发受驱动与路径限制。MWAN3 保留固定 feeds 的 iptables-nft 兼容路径，排除另一套 QModem uplink manager；代理与断线切换仍需实测。

卸载源码依据与只读检查见 [RK3568 流量卸载研究](OFFLOADING-RK3568.md)。

## 无线、磁盘与 Docker

- 无线驱动列表见 [README](../README.md#wi-fi-网卡支持)。MT7921/MT7922 PCIe 共用 `mt7921e`，并包含对应固件；MT7921 的 USB / SDIO 驱动也已集成。设备 ID 与接口必须匹配，蓝牙不在此范围内。
- 根分区保留 1 GiB。Docker 数据建议放到独立 ext4 存储，未开放无认证的网络 Docker API；容器 DNS 与多 WAN、代理组合需真机验证。
- DiskMan 包含分区、SMART 与文件系统工具；格式化和调整分区会影响数据，操作前先备份。

## 已完成的检查与待验收项目

v1.5 代码已通过 61 项 Linux Python 测试、两个前端行为测试和 shellcheck，包括官方电源后台原生编译、模拟 Socket、更新下载与校验失败、策略冲突与失败恢复、配置和成品检查。采用实际 Argon 样式完成 320～1440px 深浅色共 96 项布局检查，含短屏确认弹窗，未发现横向溢出或控件重叠；Bootstrap 样式也已检查。

这些检查未执行真实刷写或电源动作。新固件还需在设备上确认：

1. 安装、冷启动、重启、eMMC / SD、无线与有线网络。
2. QModem 拨号、重连，网络面板共享 AT 通道。
3. 首页、商店、容器及代理与多 WAN 故障恢复。
4. 在线更新在真实设备上的下载、备份与刷写流程。
5. 电量读数、UPS 恢复供电取消倒计时、每日关机与唤醒。

历史依赖审查见 [2026-10-22 报告](AUDIT-2026-10-22.md)，此前首页和终端实机修复见 [2026-10-23 记录](REPAIR-2026-10-23.md)。历史结果不代表 v1.5 已完成上述硬件验收。
