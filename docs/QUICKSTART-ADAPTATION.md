# QuickStart 首页适配

基于锁文件中的 QuickStart 0.13.0 与 nas-packages-luci，适配 ImmortalWrt 25.12 APK。

## 首页与资源

- 按已安装程序注册 LuCI 首页，避免后端启动稍慢导致路由缓存持续回退到状态页。
- 不再次压缩上游前端；入口脚本和自定义样式使用内容摘要版本，避免旧资源缓存。
- 追加网络面板磁贴，复用 LuCI 登录和权限，链接到 `/cgi-bin/luci/admin/services/wlmb-server`。
- 使用蓝底白色 Logo，适配深浅色，手机端保留原生横向滑动。
- ttyd 入口为“系统 → 终端”，使用系统账号登录；登录输出保留 BusyBox 与 SWRT Banner。

## 软件源状态

上游检测会请求 APK 索引的独立 `.asc` 地址，而 ImmortalWrt 对应源不提供该文件。适配只在原结果为软件源失败时，重新检查当前所有启用源的实际 `packages.adb` 索引，不覆盖真实网络或 DNS 错误。

检测使用受 LuCI 登录保护的只读接口，最多缓存 60 秒，源配置变化立即失效；不安装软件、不修改源、不绕过 APK 签名校验。索引可达不代表每个应用的依赖均满足。

默认使用南京大学 ImmortalWrt 镜像与独立 iStore 兼容源。仅用于编译且没有公开二进制索引的 feeds 不写入在线源列表；源配置按钮进入系统软件包管理页。

## 上游说明

[QuickStart APK 支持](https://github.com/linkease/nas-packages/commit/c82c458b61e531d85524099c6864b0641e7e866a) · [前端压缩问题](https://github.com/linkease/nas-packages-luci/issues/76) · [首页路由问题](https://github.com/linkease/nas-packages-luci/issues/87)
