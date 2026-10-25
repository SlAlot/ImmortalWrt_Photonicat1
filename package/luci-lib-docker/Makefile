include $(TOPDIR)/rules.mk

PKG_NAME:=luci-lib-docker
PKG_VERSION:=26.298.2
PKG_RELEASE:=1
PKG_LICENSE:=AGPL-3.0
PKG_LICENSE_FILES:=LICENSE
PKG_MAINTAINER:=lisaac <lisaac.cn@gmail.com> \
	Florian Eckert <fe@dev.tdt.de>

LUCI_TYPE:=col
LUCI_TITLE:=LuCI library for Docker applications
LUCI_DESCRIPTION:=Lua Docker Engine API retained for iStore applications
LUCI_DEPENDS:=@(aarch64||arm||x86_64) +luci-compat +luci-lib-jsonc +luci-lib-nixio
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
