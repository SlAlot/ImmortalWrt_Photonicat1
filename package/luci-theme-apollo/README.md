# Apollo

面向现代 LuCI 的主题，沿用 [网络面板](https://github.com/SlAlot/wlmb-server) 的配色、图标与视觉语言。作者：**SlAlot**。

- 统一字体、按钮、输入框、卡片、弹窗与二级菜单。
- 桌面和平板使用侧栏；手机使用抽屉导航，支持返回关闭、键盘操作及安全区域。
- 外观可在跟随系统、浅色、深色之间切换，偏好保存在当前浏览器。
- 顶栏显示有效电量，点击进入光影猫管理；读数过期或服务不可用时不显示假电量。
- 使用 LuCI 原生登录、权限和配置表单；不另建账号，不改拨号、防火墙或电源策略。

## 安装

主要适配 **ImmortalWrt / OpenWrt 25.12 的 ucode LuCI**。主题本身与处理器架构无关，电池显示需要已适配电池数据的 `wlmb-server >= 1.1.5`。没有电池服务时，其余主题功能仍可使用。

从 Actions 下载对应的安装包。APK 系统安装 `.apk`，OPKG 系统安装 `.ipk`，不要混用。

```sh
apk add --allow-untrusted ./luci-theme-apollo-*.apk
# 使用 OPKG 的系统：
opkg install ./luci-theme-apollo_*.ipk
```

手动下载的 APK 尚未加入可信软件源，安装前应确认包来自本仓库的构建。安装后在“系统 → 系统 → 语言和界面”选择 **Apollo**，刷新页面。

与 [luci-app-wlmbstart](https://github.com/SlAlot/luci-app-wlmbstart) 搭配可使用网络面板首页。未安装首页时，LuCI 原生页面仍可独立使用。Bootstrap 作为卸载回退主题保留；不会安装 Argon。

## 编译进固件

```sh
git clone https://github.com/SlAlot/luci-theme-apollo.git package/luci-theme-apollo
```

选择 `LuCI → Themes → luci-theme-apollo`。首次安装会注册 Apollo；原来使用 Argon、Bootstrap 或未设置主题时会切换到 Apollo，其他自选主题予以保留。

## 开发

```sh
npm ci --prefix tests --ignore-scripts
node tests/validate.cjs
```

Actions 使用官方 OpenWrt SDK 构建架构无关的 IPK、APK 包。SDK 仅用于打包，不代表所有 LuCI 版本或第三方应用均已实测。菜单权限取自 LuCI，不依赖固定插件列表；未知应用使用中性的应用图标。

原创代码使用仓库中的非商业与来源声明许可。网络面板图标及视觉来源见安装包内 `apollo/notices.html`；LuCI 兼容样式和模板保留 Apache-2.0 声明，Framework7 图标保留 MIT 声明。
