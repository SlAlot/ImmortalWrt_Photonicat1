# 构建与维护

## GitHub Actions

打开 [Build SWRT Photonicat1](https://github.com/SlAlot/ImmortalWrt_Photonicat1/actions/workflows/swrt.yml)，点击 **Run workflow**，选择 `main`。

- `release_version`：留空自动递增；指定时填写高于已有发布的版本，例如 `2.3`。编号按 `1.9 → 2.0 → 2.1` 递增。
- `publish_release`：开启则检查和编译成功后发布，关闭则仅保存固件附件。
- 构建相关文件推送到 `main` 会触发编译；维护提交可用 `[skip firmware]` 仅运行检查。手动触发仍完整构建。
- 文档整理提交使用 `[skip ci]` 避免仅因组件 README 路径触发固件编译。

## 目录

| 路径 | 用途 |
| --- | --- |
| `.config` | 固件配置 |
| `sources.lock.json`、`feeds.conf.default` | 固定源码和 feeds 版本 |
| `files/` | 系统预置文件 |
| `package/` | 网络面板、更新器、电源服务、硬盘保活与兼容库 |
| `patches/`、`scripts/` | 适配、配置与成品检查 |
| `tests/` | 回归检查 |
| `.github/workflows/swrt.yml` | 自动检查、构建和发布 |

更新上游组件时同步锁文件及对应摘要。网络面板使用固定版本的 ARM64 musl 程序，并核对 SHA-256。

网络面板 1.1.5 的电量由 `swrt-wlmb-battery` 开机采集服务接入：每 20 秒只读查询现有电源服务，原子写入 RAM 中的 `/var/run/wlmb-server/battery.json`，由已有 `/api/status` 返回。采集失败立即标为不可用，停止更新超过 60 秒后由网络面板判定过期。光影猫一代不能确认实际充电电流，`charging` 保持 `null`，不把外部供电当作正在充电。接口规范见 [上游电池接入说明](https://github.com/SlAlot/wlmb-server/blob/v1.1.5/docs/BATTERY.zh-CN.md)。

## 成品检查

发布前检查必需包与冲突包、更新器版本、内核电源配置、镜像摘要、MBR、RK3568 Loader、U-Boot 和设备元数据；失败即停止发布。Release 保留 SquashFS、ext4 和 `sha256sums` 三个附件。

Actions 的构建诊断附件保存最终配置、清单和日志，保留 7 天；固件附件保留 14 天。源码、单项测试与模拟结果不能替代具体硬件组合的运行验证。

## 首页与主题

- [luci-theme-apollo](https://github.com/SlAlot/luci-theme-apollo)：默认主题，复用网络面板视觉语言并保留原生 LuCI 表单。
- [luci-app-wlmbstart](https://github.com/SlAlot/luci-app-wlmbstart)：默认首页，读取 Rust 后端的状态缓存，不新增 AT 查询。
- iStore 商店保留，QuickStart 首页与 Argon 不再编译。

两个仓库独立构建安装包。固件内保留经过审核的运行文件快照；`sources.lock.json` 的 `luci_ui` 固定来源、提交和快照摘要，构建前由 `check-ui-plugins.py` 核验。同步上游改动时同时更新包目录与锁文件。

界面尺寸、字体及交互约定见两个项目的 `STYLE.md`。浏览器尺寸检查应覆盖 360 / 390 / 768 / 1024 / 1440px，并包括登录、菜单、长表格和弹窗。
