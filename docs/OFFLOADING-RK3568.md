# 光影猫一代 / RK3568 流量卸载研究

检查日期：2026-10-22。对象为本项目固定的 ImmortalWrt `96f566f`、Linux **6.12.112** 和 firewall4 `b6e5157`，不是对所有 RK3568 固件和外接网卡的泛化结论。

## 默认策略

```text
flow_offloading=1
flow_offloading_hw=1
```

两项均默认开启，保留 firewall4 原有的硬件能力探测及软件回退。仅凭潜在的策略路由兼容风险，不足以关闭全局加速；实际问题应按流量路径、规则和复现条件定位。

当前源码的结论是：**光影猫内置 GMAC/stmmac 路径没有接入 Netfilter 硬件 NAT flowtable，预计实际主要使用软件 flowtable。** 此为驱动与补丁审查的判断，尚无本机吞吐、CPU 占用或连接状态实测数据。勾选硬件选项、千兆测速结果、网口日志出现 “Flow TC” 均不足以证明硬件 NAT 已生效。

## 几种加速的区别

| 功能 | 实际含义 | 对本项目的判断 |
| --- | --- | --- |
| 软件 flow offloading | 已建立的合格转发流进入内核快转路径，减少逐包经过普通转发规则的开销；仍使用 CPU | 当前应保留的主要加速路径，具体收益需用相同条件测量 |
| 硬件 flow offloading | 驱动把连接转发、地址改写等动作下发到支持的硬件 | 当前 stmmac 缺少所需接入，不能把选项开启视为已成功下发 |
| 校验和、TSO 等网口卸载 | 在网口能力范围内减少分段、校验和等操作的 CPU 开销 | 与整条连接的硬件 NAT 是不同能力，应分别查看驱动与实际启用状态 |
| GRO/GSO | 内核收包聚合、发送分段等优化，与网卡能力协作 | 不能据此推导出存在硬件 NAT |
| SFE / fast-classifier | 另一套内核软件转发快路径 | 属于软件加速；需要独立适配与测试，不是给 RK3568 增加 NAT 硬件 |

软件与硬件 flowtable 的机制和状态标记以 [Linux 对应版本文档](https://github.com/gregkh/linux/blob/v6.12.112/Documentation/networking/nf_flowtable.rst)为准。不能用路由器本机运行的下载、测速进程代替 LAN→WAN 转发测试。

## 源码证据

1. **内核对硬件 flowtable 的要求**：[`nf_flow_table_offload.c`](https://github.com/gregkh/linux/blob/v6.12.112/net/netfilter/nf_flow_table_offload.c) 中 `nf_flow_table_offload_cmd()` 通过 `ndo_setup_tc(..., TC_SETUP_FT, ...)` 请求驱动绑定。NAT 转发还涉及改写、校验和和重定向等动作。
2. **当前网口驱动**：[`stmmac_main.c`](https://github.com/gregkh/linux/blob/v6.12.112/drivers/net/ethernet/stmicro/stmmac/stmmac_main.c) 中 `stmmac_setup_tc()` 支持 TC 分类块及若干队列功能，未处理 `TC_SETUP_FT`，默认返回不支持。[`stmmac_tc.c`](https://github.com/gregkh/linux/blob/v6.12.112/drivers/net/ethernet/stmicro/stmmac/stmmac_tc.c) 的 L3/L4 匹配、丢弃和队列能力不能替代跨网口 NAT 快转。
3. **本项目补丁**：检查了固定源树中 generic、rockchip 及 firewall4 的补丁。光影猫[设备树补丁](https://github.com/immortalwrt/immortalwrt/blob/96f566f4a4d04ab44592314bc0279ba9e7de3de0/target/linux/rockchip/patches-6.12/106-arm64-dts-rockchip-complete-photonicat-dts.patch)启用 GMAC/SGMII；现有 stmmac 补丁涉及接口、时钟、VLAN 等，没有为 stmmac 增加上述 flowtable 接口。
4. **firewall4 的回退**：项目[包定义](https://github.com/immortalwrt/immortalwrt/blob/96f566f4a4d04ab44592314bc0279ba9e7de3de0/package/network/config/firewall4/Makefile)固定到 `b6e5157`。其 [`fw4.uc`](https://github.com/openwrt/firewall4/blob/b6e5157527d361f99ad52eaa6da273cb0f2dfd59/root/usr/share/ucode/fw4.uc) 的 `resolve_hw_offload_devices()` 使用 nft dry-run 探测；失败时仅修改本次规则生成的内部状态并回退软件，不把 UCI 开关写成 `0`。
5. **实际规则与实际连接**：[`ruleset.uc`](https://github.com/openwrt/firewall4/blob/b6e5157527d361f99ad52eaa6da273cb0f2dfd59/root/usr/share/firewall4/templates/ruleset.uc) 的 `flags offload` 表示请求硬件卸载；实际成功连接应结合内核导出的硬件卸载标记判断。[`nf_conntrack_standalone.c`](https://github.com/gregkh/linux/blob/v6.12.112/net/netfilter/nf_conntrack_standalone.c) 会在 proc 连接表中区分软件与硬件标记。

## 核对的 GitHub 项目

| 项目 | 核对结果 |
| --- | --- |
| [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) / [Linux stable](https://github.com/gregkh/linux/tree/v6.12.112) / [firewall4](https://github.com/openwrt/firewall4) | 构成本项目实际使用的驱动、补丁和配置链路，作为结论的主要证据 |
| [NanoPi R5S Builds](https://github.com/anaelorlinski/OpenWrt-NanoPi-R5S-Builds) | 同为 RK3568 平台的历史构建项目，README 已标为停止维护并转向官方支持；其 23.05 / 5.15 配置不能直接证明本项目 25.12 / 6.12 的硬件能力 |
| [TurboACC](https://github.com/chenmozhijin/turboacc/blob/luci/README_EN.md) | 文档区分原生软件 offload、SFE、Full Cone 与 BBR，并说明安装流程会替换防火墙相关包、应用补丁；该文档面向 22.03/23.05，不能作为本项目直接集成的兼容性证明 |
| [NSS packages](https://github.com/JuliusBairaktaris/nss-packages/tree/edma-nss) | 项目明确面向 Qualcomm IPQ807x/IPQ60xx；不能把其硬件加速包当成 Rockchip 通用驱动 |

本次没有找到可用于当前光影猫内置 GMAC、并已证明适配本项目内核的 RK3568 硬件 NAT 补丁。这个结论有明确范围，不等于断言所有外接 NIC 或未来驱动都不可能支持。MediaTek Wi-Fi 芯片和其驱动的加入，也不能单独证明 Rockchip 主机拥有 MediaTek SoC 的 PPE/WED 数据路径。

## 需要实测的影响

- **直接转发**：预期能受益于软件快转，但不提供未经本机测试的 Mbps、CPU 降幅或功耗数字。
- **QModem USB/PCIe 链路**：要看实际数据设备、驱动、模组协议及 USB/PCIe 吞吐瓶颈。模组内部的 NAT、QMAP 或聚合能力与主机的硬件 flowtable 是不同层次。
- **MWAN3 切换**：flowtable 缓存出口、邻居和 NAT 信息，切换后已有连接可能需要重新建立或被正确清理。当前 MWAN3 的[实现](https://github.com/immortalwrt/packages/blob/d200499b31751dc5c72905f37a747712f009f155/net/mwan3/files/lib/mwan3/mwan3.sh)会按配置在对应事件清理连接跟踪；需要在实际 WAN、Wi-Fi 中继和蜂窝组合下检查。
- **PassWall / OpenClash**：需要分别测试直连流量与实际代理模式。被本机代理接管、需要用户态加解密的流量，不应期待全部变为网口硬件 NAT。策略变更时还应观察旧连接状态。
- **SQM/QoS、统计和抓包**：快转会改变部分规则、计数或观测路径；这些功能是否正常需要分别验证，不能由开关值推断。

以上是需要验证的交互，不代表已经在这台设备上复现故障。默认保留两项开启，不统一排除所有 MWAN3 流量，也不改写内核/驱动来伪造硬件成功状态。

## 设备上只读检查

在产生一条持续的 LAN→WAN TCP/UDP 转发流时执行。下面的命令不改配置、不重启网络，也不输出连接表中的 IP 地址：

```sh
uci -q get 'firewall.@defaults[0].flow_offloading'
uci -q get 'firewall.@defaults[0].flow_offloading_hw'
for dev in eth0 eth1; do
    printf '%s: ' "$dev"
    readlink -f "/sys/class/net/$dev/device/driver"
done
nft list flowtable inet fw4 ft
if [ -r /proc/net/nf_conntrack ]; then
    awk '/\[HW_OFFLOAD\]/ {hw++; next}
         /\[OFFLOAD\]/ {sw++}
         END {printf "active software offload: %d\nactive hardware offload: %d\n", sw, hw}' /proc/net/nf_conntrack
else
    echo 'Connection-table observation unavailable; offload state is unknown'
fi
logread | grep -F 'Hardware flow offloading unavailable'
```

空闲时没有标记不能证明不支持；`flags offload` 也不能证明已有流成功下发。应结合持续转发时的标记、回退日志和驱动能力判断。UCI 为 `1` 且出现软件回退日志，是原生能力探测的正常结果之一，不是本项目把默认值关闭了。

性能验证应由路由器两侧的独立设备产生流量，记录吞吐、各核 softirq/CPU、温度与丢包，固定 MTU、频率、方向和代理模式，重复多次。若需要区分硬件选项的额外收益，可在维护窗口对比“软件开/硬件关”与“两项都开”，保持软件卸载开启。当前没有代用户执行任何开关对照试验或网口卸载变更。
