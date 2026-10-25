# Docker 兼容性与验证范围

## 本次排查与修复

1. **Docker 菜单改变**：锁定的上游 LuCI 将管理器改为 JS 实现，入口位于 `admin/services/dockerman`，同时删除了旧 Lua 库。SWRT 将管理页放回独立的 `admin/docker` 菜单，内部链接跟随调整，保留旧地址及原有登录、ACL、POST 限制。
2. **iStore Lua 应用兼容**：检查官方应用源码发现 18 个文件调用 `luci.docker`，另 5 个文件调用 `luci.model.docker`，涉及 ITTools、Home Assistant / CodeServer 终端等。从同一 ImmortalWrt 上游删除前的版本同时保留这两个库模块，仅提供 API，不安装第二套管理页或守护进程。构建中明确选择并检查 `luci-lib-docker`、taskd、xterm、Compose、containerd、runc、veth 和挂载工具；最终固件清单缺失会阻止发布。
3. **默认 WAN 拦截误伤回包**：上游为 `DOCKER-USER` 设置的默认规则会拒绝从 WAN 进入 docker0 的所有流量，包含容器主动访问外网后的回包。默认匹配增加 `! --ctstate RELATED,ESTABLISHED`，继续拦截新建的 WAN 入站连接；已有用户自定义匹配项保持优先。
4. **路由转发策略**：通过 UCI 支持 `ip_forward_no_drop`，默认写入 Docker 的 `ip-forward-no-drop: true`，让 Docker 保留系统原有转发策略。继续使用 firewall4 / iptables-nft，不更换整套防火墙，也不关闭流量卸载。
5. **容器日志**：锁定的 JS 管理器未处理 Docker 的 stdout/stderr 多路复用帧。回移上游提出的日志解码、空白与换行显示修复，RPC 使用本地 Unix socket，不依赖开放 2375 端口。
6. **存储**：继续使用既有的全新 SquashFS 安装修复，将未使用的默认数据目录放到原生 `/overlay/docker`，避免 OverlayFS 套 OverlayFS。已有数据不会自动搬移、清空或隐藏。
7. **再次复查补充**：旧菜单隐藏标题后，旧根入口改为直接别名，避免 LuCI 无法选择首页。Lua 接口先拼接完整响应再解析 JSON / NDJSON，统一连接、发送和空响应的错误码，关闭连接失败的 socket，并正确处理跨 HTTP 数据块的日志帧及普通终端日志。JS 管理器的 RPC 与流式接口也改为拼接完整响应头和循环写出请求，流式接口补齐 HTTP 模块导入。
8. **启动入口冲突防护**：真机官方系统同时安装了使用 `/etc/init.d/docker` 的旧 `luci-app-docker` 与标准 `/etc/init.d/dockerd`。SWRT 只选择标准 dockerd 和 luci-app-dockerman，并在配置解析、成品清单两处拒绝混入旧插件，避免两套入口争用同一守护进程。

所有 feed 修改先校验锁定源码的 SHA256；上游文件不匹配时停止准备，不做模糊套用。记录位于 Actions 诊断包中的 `docker-compat.json`。

## 验证

- 使用隔离的 x86_64 Linux 环境与 **Docker 29.6.1**，对应固件锁定的 Engine 版本，执行容器创建、可写层、数据卷写入与读取、bridge HTTP、DNS 测试。
- 在真实 `DOCKER-USER` 链复现默认规则造成的 HTTP 失败；替换为修正规则后同一访问通过。
- 守护进程重启后验证 `unless-stopped` 自启动、原数据卷内容和容器 HTTP；验证本机发布端口可访问，同时隔离网络命名空间模拟的新 WAN 入站仍被拒绝。
- 使用与固件锁定版本一致的 **Compose 5.1.4** 完成服务创建、启动、正常退出与清理，其官方二进制 SHA256 已核对。
- 使用保留的两个 Lua 模块连接真实 Docker Unix socket，检查 `_ping`、`info`、容器列表，以及控制台使用的 `new()` / `containers:inspect()`；测试宿主使用 LuaSocket / UCI 适配层替代 OpenWrt 对应模块，不能代替目标固件模块装载验证。
- 菜单、原有权限限制、日志二进制帧、feed 漂移拒绝和准备流程有回归测试；JS 和 ucode 的二进制日志解码均已执行验证，Shell 与 Lua 语法检查通过。
- 再次复查的 34 项相关 Linux 测试通过；GitHub 完整 Linux 回归 98 项全部通过。
- 再次复查新增 13 组 Lua 传输边界用例，初始 10 组在修复前全部失败，修复后 13 组通过。另验证了 ucode RPC 在分段响应头、Content-Length 与 chunked JSON 下的实际执行结果，覆盖请求分次写入及旧菜单别名。
- 修改后的 Lua API 再次连接真实 Docker 29.6.1，读取含 20 KB 元数据的容器响应并验证旧控制台模型；容器可写层、数据卷、bridge HTTP 与 DNS 测试再次通过。
- 修复首次正式构建暴露的包发现遗漏：兼容库 Makefile 补齐 OpenWrt 扫描声明。使用锁定版本的真实 `include/scan.mk` 和 GNU Make `DUMP=1` 验证包名、版本及依赖可生成，并增加使用同一扫描表达式的回归检查。

## 2026-10-25 RK3568 真机复核

本轮接入的是官方 `photonicatWrt 26.10.0` / Linux `6.12.103`。测试使用独立网络命名空间和临时数据目录，没有刷写系统，也没有替换官方电源管理器或修改现用防火墙配置。

从已校验的 SWRT v1.7 SquashFS 镜像中提取实际 ARM64 程序，验证 Docker **29.6.1**、containerd **2.2.5**、runc **1.3.6**、Compose **5.1.4**；再加载本次修正的 Lua 库和 ucode RPC，使用真机原生 nixio、LuCI 和 Unix socket，而非模拟 socket。

| 检查 | 结果 |
| --- | --- |
| 容器执行、可写层、数据卷跨容器读写 | 通过 |
| 重新启动守护进程后保留数据卷、恢复 unless-stopped 容器 | 通过 |
| SWRT 编译出的 Compose 创建、运行、正常退出和清理 | 通过 |
| Lua `_ping`、版本、info、容器列表、inspect、日志及 iStore 所用 model.new | 通过 |
| 修正后的 ucode RPC 查询版本、容器列表 | HTTP 200，JSON 正常 |
| 系统根 OverlayFS 存储 | 真机复现容器挂载 `invalid argument` |
| 原生 F2FS `/overlay` 存储 | 同一容器写入通过，验证现有目录修复 |
| 旧 WAN 拦截规则 | 真机复现主动 HTTP 请求的回包被拒绝 |
| 修正后的 WAN 规则 | 容器 HTTP、UDP DNS 通过，新的 WAN 入站仍被拒绝 |
| 容器 HTTP 与发布端口 | 在隔离网络中访问通过 |

官方自带 Compose 在本机执行 `version` 即出现段错误，但 SWRT 镜像中的 Compose 和 Docker 官方 ARM64 Compose 均能运行，因此没有照搬官方 Docker 软件包或双启动配置。

这些结果验证了目标硬件上的用户态程序及修复，**不等于已经启动本次完整 SWRT 固件**。其内核、LuCI 页面、外接磁盘、蜂窝网络、多 WAN、代理组合和商店应用实际镜像仍需在目标固件上验收；没有把一个最小容器测试描述成所有 iStore 应用均已验证。ARM 构建、镜像校验和发布状态以对应 Actions 结果为准。

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
