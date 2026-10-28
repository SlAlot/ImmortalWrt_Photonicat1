# Docker 使用与兼容性

入口：左侧 **Docker**。固件集成 Docker、Compose、containerd、runc、taskd、xterm 和 iStore 应用需要的 Lua 接口。

## 存储与网络

- 全新 SquashFS 安装的数据目录为 `/overlay/docker`，使用原生文件系统，避免容器可写层叠加在系统根 OverlayFS 上。
- eMMC 首次开机自动扩容，不设置 Docker 容量配额或额外启动限制。已有容器及用户指定目录不自动迁移。
- 可使用外部原生文件系统存放容器数据；更改目录前停止容器、完整备份，再迁移和验证。
- 配置备份不包含 Docker 镜像、容器和数据卷。TF 卡中的应用缓存与 Docker 宿主数据可能位于不同目录，需分别核对。
- 使用 firewall4 / iptables-nft。容器主动连接的回包允许通过，默认继续阻止新的 WAN 入站连接；Docker 保留路由器原有转发策略。
- 管理器使用本机 Unix socket，无需开放无认证的 Docker 网络 API。软、硬件流量卸载保持开启。

## iStore 应用

保留 `luci.docker` 和 `luci.model.docker` 兼容接口，旧“服务 → Dockerman”地址仍可访问。固件只安装标准 dockerd 与 luci-app-dockerman，避免两套启动入口冲突。

应用是否可用还取决于 ARM64 镜像、版本依赖、可用存储、端口和网络。下载失败时分别检查磁盘空间、文件系统、DNS / TLS 和镜像仓库连通性。

## 已验证范围

已在 RK3568 隔离环境验证固件中的 ARM64 Docker、Compose、容器可写层、数据卷、重启恢复、HTTP / DNS、Lua 接口和 ucode RPC。回归覆盖分段响应、日志解码、菜单入口及构建包发现。

这些检查覆盖基础能力与兼容接口，并非逐一验收商店所有应用；多 WAN、代理、外接磁盘和具体应用需按实际配置验证。

## 源码与依据

- [兼容库来源与许可](../package/luci-lib-docker/UPSTREAM.md)
- [Docker 路由器转发策略](https://docs.docker.com/engine/network/packet-filtering-firewalls/#docker-on-a-router)
- [DOCKER-USER 规则](https://docs.docker.com/engine/network/firewall-iptables/)
- [LuCI 日志帧解码](https://github.com/openwrt/luci/pull/8976)与[日志换行处理](https://github.com/openwrt/luci/pull/8977)
