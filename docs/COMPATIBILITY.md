# SWRT 2.0 兼容性说明

安装和使用步骤见 [README](../README.md)，组件版本见 [sources.lock.json](../sources.lock.json)。

## 固件与软件包

- 适用光影猫一代 / RK3568，支持 1+8、2+16、4+64 GB；不适用于二代。
- 基于 ImmortalWrt `openwrt-25.12`，使用 APK。其他固件的 IPK 和不同内核 ABI 的驱动不能直接安装。
- v1.9 及更早版本首次升级到 v2.0，使用“系统 → 备份与升级”上传同类型 `.img.gz`。v2.0 起内置更新器修复，后续可正常使用 SWRT 在线更新。
- 在线更新只接收本仓库正式新版，校验附件、大小、SHA-256、设备和分区兼容性。切换 SquashFS / ext4、跨系统安装或恢复分区布局时使用 USB 线刷。

## QModem、网络面板与多 WAN

- 使用 QModem Next、Tom AT 核心和 Tom 拨号组件；不同时安装旧 QModem 界面及依赖旧界面的扩展。
- 网络面板默认 `auto` 共享模式，避免与 QModem 争用 AT 串口。可用协议取决于模组固件、USB 组合和连接方式。
- USB 开机扫描由 procd 管理，遵守用户设置；PCIe MHI 依赖按当前内核提供的包名适配。
- MWAN3 自动纳入匹配的 QModem IPv4 接口，保留用户配置；删除模组后清理旧成员。
- PassWall、OpenClash 和多 WAN 的组合取决于实际规则。软、硬件流量卸载均默认开启，实际加速能力见[流量卸载说明](OFFLOADING-RK3568.md)。

## 首页与 iStore

- 首页按已安装文件注册路由，资源采用内容摘要版本，避免启动时回退和浏览器旧缓存。
- 网络面板磁贴使用蓝白图标，手机端保留横向滑动。
- 软件源检测检查实际 APK 索引，保留真实网络、DNS、TLS 和源错误；APK 签名校验由包管理器执行。
- 默认南京大学 ImmortalWrt 镜像和独立 iStore 兼容源。iStore 应用仍需匹配 ARM64、系统依赖和内核版本；系统更新使用 SWRT 固件。

实现细节见[首页适配](QUICKSTART-ADAPTATION.md)。

## 电源与存储

- 电源使用官方 `photonicat-pm` 内核驱动及一代设备树；后台通过内核接口工作，不与 QModem 争用串口或模组控制。
- 默认手动模式，支持车载 / UPS 和每日定时。电量按电压估算，无独立充电开关、电流或电池温度接口。
- 已验证真机启动、状态读取和三种模式保存、读回、互斥切换；完整充放电与关机唤醒周期需结合实际设备场景验证。详见[电源服务](../package/swrt-pcat-manager/README.md)。
- 首次开机扩展 eMMC 连续可用空间，保留额外数据分区，支持 F2FS / ext4；扩展的是存储，运行内存不变。
- 全新 SquashFS 安装的 Docker 使用 `/overlay/docker`，已有数据及自定义目录不自动迁移。配置备份不包含容器数据，详见 [Docker](DOCKER-COMPATIBILITY.md) 和[存储说明](STORAGE-RECOVERY.md)。

## 检查范围

构建检查覆盖配置、必需软件包、冲突包、内核电源支持、扩容、更新器回归、镜像摘要和引导结构；发布结果以对应 [Actions](https://github.com/SlAlot/ImmortalWrt_Photonicat1/actions/workflows/swrt.yml) 为准。

驱动集成不等于所有网卡型号均已实测，Docker 兼容接口不等于商店全部应用已逐一验证。遇到问题请提供版本、硬件型号、复现步骤和日志。
