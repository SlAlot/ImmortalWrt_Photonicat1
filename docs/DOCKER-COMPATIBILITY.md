# Docker 兼容性与验证范围

## 本次排查与修复

1. **Docker 菜单改变**：锁定的上游 LuCI 将管理器改为 JS 实现，入口位于 `admin/services/dockerman`，同时删除了旧 Lua 库。SWRT 将管理页放回独立的 `admin/docker` 菜单，内部链接跟随调整，保留旧地址及原有登录、ACL、POST 限制。
2. **iStore Lua 应用兼容**：检查官方应用源码发现 18 个文件调用 `luci.docker`，另 5 个文件调用 `luci.model.docker`，涉及 ITTools、Home Assistant / CodeServer 终端等。从同一 ImmortalWrt 上游删除前的版本同时保留这两个库模块，仅提供 API，不安装第二套管理页或守护进程。构建中明确选择并检查 `luci-lib-docker`、taskd、xterm、Compose、containerd、runc、veth 和挂载工具；最终固件清单缺失会阻止发布。
3. **默认 WAN 拦截误伤回包**：上游为 `DOCKER-USER` 设置的默认规则会拒绝从 WAN 进入 docker0 的所有流量，包含容器主动访问外网后的回包。默认匹配增加 `! --ctstate RELATED,ESTABLISHED`，继续拦截新建的 WAN 入站连接；已有用户自定义匹配项保持优先。
4. **路由转发策略**：通过 UCI 支持 `ip_forward_no_drop`，默认写入 Docker 的 `ip-forward-no-drop: true`，让 Docker 保留系统原有转发策略。继续使用 firewall4 / iptables-nft，不更换整套防火墙，也不关闭流量卸载。
5. **容器日志**：锁定的 JS 管理器未处理 Docker 的 stdout/stderr 多路复用帧。回移上游提出的日志解码、空白与换行显示修复，RPC 使用本地 Unix socket，不依赖开放 2375 端口。
6. **存储**：继续使用既有的全新 SquashFS 安装修复，将未使用的默认数据目录放到原生 `/overlay/docker`，避免 OverlayFS 套 OverlayFS。已有数据不会自动搬移、清空或隐藏。

所有 feed 修改先校验锁定源码的 SHA256；上游文件不匹配时停止准备，不做模糊套用。记录位于 Actions 诊断包中的 `docker-compat.json`。

## 验证

- 使用隔离的 x86_64 Linux 环境与 **Docker 29.6.1**，对应固件锁定的 Engine 版本，执行容器创建、可写层、数据卷写入与读取、bridge HTTP、DNS 测试。
- 在真实 `DOCKER-USER` 链复现默认规则造成的 HTTP 失败；替换为修正规则后同一访问通过。
- 守护进程重启后验证 `unless-stopped` 自启动、原数据卷内容和容器 HTTP；验证本机发布端口可访问，同时隔离网络命名空间模拟的新 WAN 入站仍被拒绝。
- 使用与固件锁定版本一致的 **Compose 5.1.4** 完成服务创建、启动、正常退出与清理，其官方二进制 SHA256 已核对。
- 使用保留的两个 Lua 模块连接真实 Docker Unix socket，检查 `_ping`、`info`、容器列表，以及控制台使用的 `new()` / `containers:inspect()`；测试宿主使用 LuaSocket / UCI 适配层替代 OpenWrt 对应模块，不能代替目标固件模块装载验证。
- 菜单、原有权限限制、日志二进制帧、feed 漂移拒绝和准备流程有回归测试；JS 和 ucode 的二进制日志解码均已执行验证，Shell 与 Lua 语法检查通过。
- 32 项相关 Linux 测试通过；Windows 回归 96 项中 48 项通过、48 项因平台依赖跳过。未修改的 MCU C 测试未在本次隔离环境重复运行。

这不是 RK3568 真机或实际 iStore 应用安装验收。路由器目前无法接入；完整交叉编译、LuCI 页面加载、外接磁盘、蜂窝网络、多 WAN 与代理组合仍需目标固件验证。当前构建已取消，未因本次修改重新编译或发布。

## 使用限制

- 系统根分区为 **1 GiB**，修改目录不能增加容量。大型镜像可能需要数 GiB，下载及解包还会占用额外空间；请使用稳定、已挂载的 ext4 存储。
- 保留配置升级可能保留旧的 `/opt/docker` 和已有数据。本次不会自动迁移，避免数据丢失；更改存储目录前停止容器、完整备份，再迁移和验证。
- 镜像下载失败要区分空间不足、文件系统错误、DNS / TLS 和镜像站连通性。未默认加入未经验证的公共加速站，未修改签名验证或强制覆盖软件包依赖。
- iStore 能安装不代表商店内所有应用都适用于当前 OpenWrt 版本。尚未逐个验证商店应用及其镜像、空间、架构要求。

## 上游依据

- [锁定的 Docker JS 菜单](https://github.com/immortalwrt/luci/blob/61e876e98f91446fd8968dfede721b98ddf80a32/applications/luci-app-dockerman/root/usr/share/luci/menu.d/luci-app-dockerman.json)
- [上游移除 Lua 实现](https://github.com/immortalwrt/luci/commit/61ac48c5c42d6aae43f6db38c4ff061f81b9b4e9)；[保留库的源码与校验值](../package/luci-lib-docker/UPSTREAM.md)
- [iStore ITTools 的 Lua 库依赖](https://github.com/linkease/openwrt-app-actions/blob/b60e3da2b4e66f62f75efe226c8c72ca9f63f4e8/applications/luci-app-ittools/Makefile)
- [Docker 路由器转发策略](https://docs.docker.com/engine/network/packet-filtering-firewalls/#docker-on-a-router)；[DOCKER-USER 连接状态规则](https://docs.docker.com/engine/network/firewall-iptables/)
- [日志帧解码 PR #8976](https://github.com/openwrt/luci/pull/8976)；[日志空白显示 PR #8977](https://github.com/openwrt/luci/pull/8977)（本次检查时尚未合入上游，保留补丁来源与原许可证）
