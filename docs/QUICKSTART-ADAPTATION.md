# QuickStart 首页适配记录

适用版本：固定 nas-packages-luci `93e94175535c0b793300eacb3fe231601d0e87d8`、QuickStart 二进制 0.13.0、ImmortalWrt 25.12 APK。检查日期：2026-10-23。

## 软件源误报

上游 [QuickStart 0.13.0 提交](https://github.com/linkease/nas-packages/commit/c82c458b61e531d85524099c6864b0641e7e866a) 声明支持 APK，不能简单归因于“不支持 APK”。[iStore #215](https://github.com/istoreos/istore/issues/215) 也有类似误报，但故障原因需以本固件固定版本为准。

检查已通过 SHA-256 校验的官方二进制包：`40eeaba1fbb4cfb732cb5c4759103d9307cb46b83f98b4514934d3e13e8c945b`。其 `getApkDistFeedUrlForCheck` 从 `/etc/apk/repositories.d/distfeeds.list` 取 base 索引 URL，再拼接 `.asc`。`NetworkOnlineChecker.doCheck` 用 curl 检查该 URL。x86_64 同发行包中的对应地址为 `0x7bd260`、拼接处 `0x7bd2c1`，只用于定位核对，项目不修改二进制。

对本分支默认源进行 HEAD 验证：

| 请求 | 结果 |
| --- | --- |
| `https://downloads.immortalwrt.org/releases/25.12-SNAPSHOT/packages/aarch64_generic/base/packages.adb` | HTTP 200 |
| 同 URL 追加 `.asc` | HTTP 404 |

适配方案：仅在首页原结果为 `softSourceFailed` 时，通过继承 LuCI admin 登录认证的只读接口，再检查设备当前源配置里的 `base/packages.adb`。检查不接受客户端传入 URL，不替换任何软件源，不绕过 APK 签名校验，不执行安装或更新。HTTP、TLS、DNS或超时失败仍保留错误；已有网络/DNS错误不覆盖。检查最多缓存 60 秒，源配置内容变化立即使缓存失效。

该状态表示 base 索引可达，不保证所有 feeds、签名、软件包依赖或内核 ABI 均可用。标准 APK 管理器负责实际索引校验和安装。源配置按钮进入系统软件包管理页，避免上游只包含 OpenWrt 镜像站的向导改错 ImmortalWrt 源。

## 网络面板与终端

在原生快捷卡片数据中追加“网络面板”，链接为 `/cgi-bin/luci/admin/services/wlmb-server`，复用已有登录与 ACL；不将浏览器直接引向 1117 API 端口。磁贴支持宽屏五列、窄屏换行及手机单列。

作者提供的两张 PNG 原样保存；CSS 只显示中央图形区域。Logo 根据 Argon `mode` 的 dark/light/normal 设置切换，normal 跟随系统配色。

加入 `ttyd`、`luci-app-ttyd` 与简体中文翻译，构建配置和最终镜像清单同时检查，缺失则禁止发布。默认绑定 LAN、7681 端口、运行 `/bin/login`，不直接启动免登录 shell。入口为“系统 → 终端”；首页已有终端按钮也指向同一 LuCI 页面。

终端 Banner 使用 SWRT 字符画，下方标注作者 `SlAlot` 和 `ImmortalWrt`。软、硬件流量卸载配置均保持开启。

## 验证范围

真实固定前端完成补丁应用与重复应用检查；上游上下文变化时构建直接报错。回归检查覆盖源检查成功/失败/超时、缓存失效、前端不掩盖 DNS/网络错误和最终镜像缺少 ttyd 时禁止发布。

本地浏览器预览工具不可用，未完成截图验收；终端与首页的最终表现仍须在实机上确认。
