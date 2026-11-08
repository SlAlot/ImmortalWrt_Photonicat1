#!/usr/bin/env bash
set -euo pipefail

sdk=$1
pkg=$2
box=openwrt-luci-smoke
jar=$(mktemp)
response=$(mktemp)
cleanup() {
    docker rm -f "$box" >/dev/null 2>&1 || true
    rm -f "$jar" "$response"
}
trap cleanup EXIT

docker run -d --name "$box" -p 127.0.0.1:18080:80 \
    --entrypoint /bin/sh "openwrt/rootfs:$sdk" -c 'sleep 1200' >/dev/null
docker cp "$pkg" "$box:/tmp/plugin.${pkg##*.}"
# 用已发布的后端验证安装依赖，模组硬件由真机验证。
ext=${pkg##*.}
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 100 "https://github.com/SlAlot/wlmb-server/releases/download/v1.1.6/wlmb-server-1.1.6-x86_64.$ext" -o "$response"
docker cp "$response" "$box:/tmp/wlmb-server.$ext"
docker exec -e SMOKE_HASH="$(openssl passwd -6 luci-smoke)" "$box" sh -ec '
    mkdir -p /var/lock /var/run/ubus
    if command -v apk >/dev/null; then
        apk update
        apk add luci-base luci-mod-admin-full luci-theme-bootstrap uhttpd
    else
        opkg update
        opkg install luci-base luci-mod-admin-full luci-theme-bootstrap uhttpd
    fi
    sed -i "s#^root:[^:]*:#root:${SMOKE_HASH}:#" /etc/shadow
'
docker exec -d "$box" /sbin/ubusd -s /var/run/ubus/ubus.sock
docker exec "$box" sh -ec 'for n in 1 2 3 4 5; do ubus list && exit 0; sleep 1; done; exit 1'
docker exec -d "$box" /sbin/procd -s /var/run/ubus/ubus.sock
docker exec "$box" ubus -t 15 wait_for system service
docker exec "$box" /etc/init.d/rpcd start
docker exec "$box" ubus -t 15 wait_for session
docker exec "$box" sh -ec '
    if command -v apk >/dev/null; then
        apk add --allow-untrusted /tmp/wlmb-server.apk /tmp/plugin.apk
    else
        opkg install /tmp/wlmb-server.ipk /tmp/plugin.ipk
    fi
'
docker exec "$box" sh -ec '
    uci -q delete uhttpd.main.listen_http || true
    uci add_list uhttpd.main.listen_http=0.0.0.0:80
    uci set uhttpd.main.redirect_https=0
    uci commit uhttpd
    /etc/init.d/uhttpd restart
'

url=http://127.0.0.1:18080/cgi-bin/luci
status=$(curl -sS --retry 8 --retry-connrefused --retry-delay 1 "$url/" -o "$response" -w '%{http_code}')
# LuCI 用 403 返回未登录状态及登录表单。
test "$status" = 403 || test "$status" = 200
grep -q 'luci_password' "$response"
curl -fsS -c "$jar" -d 'luci_username=root&luci_password=luci-smoke' "$url/" -o "$response"
curl -fsSL -b "$jar" "$url/admin/wlmbstart" -o "$response"
grep -q 'wlmbstart/home' "$response"
docker exec "$box" sh -ec '
    for n in 1 2 3 4 5; do
        if ubus call wlmbstart cellularDevices | grep -q time; then exit 0; fi
        sleep 1
    done
    exit 1
'
