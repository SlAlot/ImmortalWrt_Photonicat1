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

适配方案：仅在首页原结果为 `softSourceFailed` 时，通过继承 LuCI admin 登录认证的只读接口，再检查设备当前源配置里的所有 `packages.adb` 索引。检查不接受客户端传入 URL，不替换任何软件源，不绕过 APK 签名校验，不执行安装或更新。HTTP、TLS、DNS或超时失败仍保留错误；已有网络/DNS错误不覆盖。检查最多缓存 60 秒，源配置内容变化立即使缓存失效。

该状态表示当前配置的索引 URL 均可达，不保证所有 feeds、签名、软件包依赖或内核 ABI 均可用。标准 APK 管理器负责实际索引校验和安装。源配置按钮进入系统软件包管理页，避免上游只包含 OpenWrt 镜像站的向导改错 ImmortalWrt 源。

## 网络面板与终端

在原生快捷卡片数据中追加“网络面板”，链接为 `/cgi-bin/luci/admin/services/wlmb-server`，复用已有登录与 ACL；不将浏览器直接引向 1117 API 端口。保留上游磁贴布局与尺寸，手机端仍左右滑动浏览；新增磁贴位于列表末尾。

作者提供的两张 PNG 原样保存；CSS 只显示中央图形区域，使用与其他磁贴一致的 40px 蓝色圆角底块和 24px 白色标志。Logo 根据 Argon `mode` 的 dark/light/normal 设置切换，normal 跟随系统配色。

加入 `ttyd`、`luci-app-ttyd` 与简体中文翻译，构建配置和最终镜像清单同时检查，缺失则禁止发布。默认绑定 LAN、7681 端口、运行 `/bin/login`，不直接启动免登录 shell。入口为“系统 → 终端”；首页已有终端按钮也指向同一 LuCI 页面。

终端 Banner 使用 SWRT 字符画，下方标注作者 `SlAlot` 和 `ImmortalWrt`。软、硬件流量卸载配置均保持开启。

## 验证范围

真实固定前端完成补丁应用与重复应用检查；上游上下文变化时构建直接报错。回归检查覆盖源检查成功/失败/超时、缓存失效、前端不掩盖 DNS/网络错误和最终镜像缺少 ttyd 时禁止发布。

2026-10-23 已在用户的一代设备上验证：首页认证后连续三次请求均为 HTTP 200、无跳转，脚本/样式/Logo/语言资源可达，APK 检测正常；重新建立交互 SSH 会话确认简洁登录输出。启动路由的 Lua 回归检查不需要停止设备上的后端。浏览器自动化工具超时；随后用户截图与现场确认验证了磁贴、正常网络状态和蓝白配色。详情见[实机修复记录](REPAIR-2026-10-23.md)。

## 静态资源与在线软件源补充修复

固定上游 PKG_VERSION 和 SOURCE_DATE_EPOCH 会让不同定制版本的脚本保持相同 URL、相同修改时间。入口脚本、适配模块与自定义 CSS 现改用内容摘要作为 URL 版本，避免浏览器继续加载旧磁贴和旧检测代码。

源检测不再依赖设备缺少的 cksum，改用已集成的 SHA-256；检查所有启用的索引，有任意一条失败仍显示错误。现场找到 video、istore、nas、nas_luci、qmodem 五条不存在的在线索引，移除这些地址不会卸载固件内已编译的软件包。

设备已改用实测可达的南京大学镜像及独立 iStore 兼容源，`apk update` 签名验证通过，10600 个软件包可用。只更新索引，未升级或安装软件包。用户已确认磁贴、网络状态及蓝白图标效果，授权提交编译；手机端按要求移除了布局覆盖，恢复上游左右滑动。
