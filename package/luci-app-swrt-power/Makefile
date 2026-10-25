include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-swrt-power
PKG_VERSION:=1.0.5
PKG_RELEASE:=1
PKG_LICENSE:=AGPL-3.0-only
PKG_MAINTAINER:=SlAlot

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-swrt-power
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=SWRT Photonicat 1 power management
  DEPENDS:=@TARGET_rockchip_armv8 +luci-base +rpcd +swrt-pcat-manager +wlmb-server +jsonfilter
endef

define Build/Compile
endef

define Package/luci-app-swrt-power/install
	$(INSTALL_DIR) $(1)
	$(CP) ./root/. $(1)/
	chmod 755 $(1)/usr/libexec/rpcd/luci.swrt_power
endef

$(eval $(call BuildPackage,luci-app-swrt-power))
