# SWRT 在线更新

入口：系统 → SWRT 在线更新。后端通过受 LuCI 会话与 rpcd ACL 保护的
`luci.swrt_upgrade` 接口提供状态、手动检查、下载和确认安装。

日常操作只需：检查更新 → 下载配置备份 → 下载并校验 → 确认升级。
默认不保留配置；v1.3 等旧固件需先手动升级到包含版本身份的 v1.5。

- 固定仓库 `SlAlot/ImmortalWrt_Photonicat1`，仅接收正式 `vN.D` 发布。
- 明确依赖 `jq-full`；OpenWrt 默认 `jq` 不带正则功能，无法执行版本及摘要格式校验。
- 使用 `coreutils-stat` 获取大小与所有者，避免依赖未启用的 BusyBox stat。
- 读取 `/rom/etc/swrt-release.json` 优先于 `/etc`，比较数字版本并防止回刷。
- 按挂载信息选择相同的 SquashFS / ext4 镜像，不允许切换类型。
- Release 附件名称、地址、大小和 ID 均检查；下载前重新查询同一发布以检测附件替换。
- 必须有同次发布的 `sha256sums`；有 GitHub 资产摘要时还须与清单一致。
- HTTPS 验证与重定向协议限制始终开启；不内置第三方镜像代理或访问令牌。
- 下载任务有互斥锁、空间检查和超时；页面显示实际字节进度，刷新后可恢复状态。
- 初次读取服务失败时仍显示页面并轮询恢复；刷写响应丢失时保留等待重连状态，不自动重发请求。
- 下载只到“校验完成”。独立确认后重新核对摘要及系统原生验证结果，再执行 sysupgrade。
- 默认 `sysupgrade -n`；主动勾选保留配置时使用 `-k`。从不使用 `-F`、`--force` 或分区重建选项。
- 保留配置必须得到原生验证器 `allow_backup` 许可；分区变化停止在线更新。
- 不使用 `gzip -t` 拒绝合法 fwtool 尾部；完整性由摘要和平台镜像校验负责。
- 只读权限仅能查询状态，无任意文件执行权限。所有下载／刷写操作需要写权限。
- 不定时下载，不自动安装，也不由浏览器直接请求 GitHub。

页面和确认弹窗使用网络面板样式，适配深浅色与窄屏，隔离 Argon 标题装饰；不修改网络面板服务的更新接口。

构建在根文件系统打包前写入版本身份，并在发布收集阶段核对它和文件名版本一致。
旧版未带该身份的固件需先手动升级一次。`/tmp` 中的状态、下载文件与锁不保留到新固件。

验证命令：

```sh
python3 -m unittest discover -s tests -v
node tests/test_upgrade_frontend.cjs
shellcheck -s sh package/luci-app-swrt-upgrade/root/usr/libexec/swrt-upgrade
```

隔离测试不会接触真实块设备。真机刷写属于需要用户最终确认的操作，开发与检查不得自动执行。
