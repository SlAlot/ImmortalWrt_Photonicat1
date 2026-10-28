# 构建与维护

## GitHub Actions

打开 [Build SWRT Photonicat1](https://github.com/SlAlot/ImmortalWrt_Photonicat1/actions/workflows/swrt.yml)，点击 **Run workflow**，选择 `main`。

- `release_version`：留空自动递增；指定时填写高于已有发布的版本，例如 `2.1`。编号按 `1.9 → 2.0 → 2.1` 递增。
- `publish_release`：开启则检查和编译成功后发布，关闭则仅保存固件附件。
- 构建相关文件推送到 `main` 会触发编译；维护提交可用 `[skip firmware]` 仅运行检查。手动触发仍完整构建。
- 文档整理提交使用 `[skip ci]` 避免仅因组件 README 路径触发固件编译。

## 目录

| 路径 | 用途 |
| --- | --- |
| `.config` | 固件配置 |
| `sources.lock.json`、`feeds.conf.default` | 固定源码和 feeds 版本 |
| `files/` | 系统预置文件 |
| `package/` | 网络面板、更新器、电源服务与兼容库 |
| `patches/`、`scripts/` | 适配、配置与成品检查 |
| `tests/` | 回归检查 |
| `.github/workflows/swrt.yml` | 自动检查、构建和发布 |

更新上游组件时同步锁文件及对应摘要。网络面板使用固定版本的 ARM64 musl 程序，并核对 SHA-256。

## 成品检查

发布前检查必需包与冲突包、更新器版本、内核电源配置、镜像摘要、MBR、RK3568 Loader、U-Boot 和设备元数据；失败即停止发布。Release 保留 SquashFS、ext4 和 `sha256sums` 三个附件。

Actions 的构建诊断附件保存最终配置、清单和日志，保留 7 天；固件附件保留 14 天。源码、单项测试与模拟结果不能替代具体硬件组合的运行验证。
