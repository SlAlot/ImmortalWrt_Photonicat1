include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-swrt-upgrade
PKG_VERSION:=1.1.0
PKG_RELEASE:=1
PKG_LICENSE:=AGPL-3.0-only
PKG_MAINTAINER:=SlAlot

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-swrt-upgrade
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=SWRT verified online firmware upgrade
  DEPENDS:=@TARGET_rockchip_armv8 +luci-base +rpcd +wlmb-server +curl +ca-bundle +jq-full +flock +coreutils-sha256sum +coreutils-stat +uci
endef

define Package/luci-app-swrt-upgrade/conffiles
/etc/config/swrt_upgrade
endef

define Build/Compile
endef

define Package/luci-app-swrt-upgrade/install
	$(INSTALL_DIR) $(1)
	$(CP) ./root/. $(1)/
	chmod 755 $(1)/usr/libexec/swrt-upgrade $(1)/usr/libexec/rpcd/luci.swrt_upgrade
endef

$(eval $(call BuildPackage,luci-app-swrt-upgrade))
