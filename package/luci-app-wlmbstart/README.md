# wlmbstart · 网络面板首页

基于 [wlmb-server](https://github.com/SlAlot/wlmb-server) Rust 后端的 LuCI 首页。作者：**SlAlot**。

- 展示 CPU、内存、设备温度、运行时间、实时流量和电池电量。
- 展示有效的蜂窝信号与网络接口，提供网络面板、无线、iStore、Docker、更新和终端入口。
- 只显示当前账号有权限访问的快捷入口；手机端横向滑动，平板与桌面按内容区排布。
- 复用已有登录会话和只读 RPC，不要求再次输入密码，不新增端口，也不额外发送 AT 命令。
- 过期数据、未知充电状态和服务异常均明确显示，不用假零代替。

## 安装

主要适配 **ImmortalWrt / OpenWrt 25.12 的现代 LuCI**，需要先安装并启动 **wlmb-server 1.1.5 或更新的兼容版本**。电池读数由网络面板的数据源提供，首页不会修改充放电策略。

从 Actions 下载对应的安装包。APK 系统使用 `.apk`，OPKG 系统使用 `.ipk`。

```sh
apk add --allow-untrusted ./luci-app-wlmbstart-*.apk
# 使用 OPKG 的系统：
opkg install ./luci-app-wlmbstart_*.ipk
```

手动下载的 APK 尚未加入可信软件源，安装前应确认包来自本仓库的构建。安装后重新登录 LuCI，打开“首页”；地址为 `/cgi-bin/luci/admin/wlmbstart`。

建议搭配 [Apollo](https://github.com/SlAlot/luci-theme-apollo)。首页与主题分别打包，首页也可在其他 LuCI 主题中使用。iStore 商店可以继续安装；本插件不依赖 iStore QuickStart。

## 编译进固件

```sh
git clone https://github.com/SlAlot/luci-app-wlmbstart.git package/luci-app-wlmbstart
```

选择 `LuCI → Applications → luci-app-wlmbstart`，并选中已有的 `wlmb-server` 软件包。网络面板是运行时依赖，标准构建不会重新编译它的 Rust 程序。

## 开发

```sh
npm ci --prefix tests --ignore-scripts
node tests/validate.cjs
```

Actions 使用官方 OpenWrt SDK 构建架构无关的 IPK、APK 包。界面只读取 `network-panel.status` 和 `network.interface.dump`，没有写权限。流量是所选上网接口的总速率，不能当作单个设备或单个应用的速率。

原创代码使用仓库中的非商业与来源声明许可。基于 SlAlot 的网络面板（wlmb-server），来源：[SlAlot/wlmb-server](https://github.com/SlAlot/wlmb-server)。图标来源与完整第三方许可保存在安装包内 `wlmbstart/notices.html`。
