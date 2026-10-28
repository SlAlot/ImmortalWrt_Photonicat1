# SWRT 在线更新

入口：**系统 → SWRT 在线更新**。操作顺序为 **检查更新 → 下载配置备份 → 下载并校验 → 确认升级**。

默认使用 `gh-proxy.com` 国内加速，可切换 GitHub 官方源；设置自动保存。版本查询、清单和固件下载统一走所选源，切换后重新检查。恢复备份进入系统原生页面。

**v1.9 及更早版本首次升级到 v2.0，请使用“备份与升级”上传同类型 `.img.gz`。** v2.0 起内置更新器 1.1.1，后续使用在线更新。

## 实现

- 固定仓库 `SlAlot/ImmortalWrt_Photonicat1`，仅接受正式 `vN.D` 新版；优先读取只读系统中的版本身份。
- 按当前根文件系统匹配 SquashFS / ext4，检查附件身份、大小、SHA-256、原生镜像验证和分区布局。
- HTTPS 与证书验证保持开启，使用 `jq-full`、`coreutils-stat` 和互斥锁处理格式、空间及并发检查。
- 下载只到校验完成。独立确认后再次验证，默认 `sysupgrade -n`；保留配置使用 `-k`，不使用强制刷写。
- 最终校验通过、交接前解除后台的退出清理，避免 stage2 终止进程时误删镜像。原生升级程序拒绝或意外返回时报告失败。
- LuCI 会话与 rpcd ACL 保护写操作；只读权限不能下载或刷写。不自动安装，不在响应丢失时重复提交刷写。
- 临时下载与状态位于 `/tmp`，源设置位于 `/etc/config/swrt_upgrade`。配置备份不包含容器数据。

## 验证

```sh
python3 -m unittest discover -s tests -v
node tests/test_upgrade_frontend.cjs
shellcheck -s sh package/luci-app-swrt-upgrade/root/usr/libexec/swrt-upgrade
```

隔离回归覆盖终止信号、升级拒绝、校验失败、并发与权限。发布前检查已安装的更新器版本，真机刷写须由用户确认。
