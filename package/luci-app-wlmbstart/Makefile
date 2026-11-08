include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-wlmbstart
PKG_VERSION:=1.0.0
PKG_RELEASE:=4
PKGARCH:=all
PKG_LICENSE:=LicenseRef-WLMB-NonCommercial AND MIT AND ISC
PKG_MAINTAINER:=SlAlot

include $(INCLUDE_DIR)/package.mk


define Package/luci-app-wlmbstart
  PKGARCH:=all
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=Network Panel homepage
  DEPENDS:=+luci-base
  EXTRA_DEPENDS:=wlmb-server (>=1.1.5)
endef

define Build/Compile
endef

define Package/luci-app-wlmbstart/conffiles
/etc/config/wlmbstart
endef

define Package/luci-app-wlmbstart/postinst
#!/bin/sh
if [ -z "$${IPKG_INSTROOT}" ]; then
	/etc/init.d/rpcd reload 2>/dev/null
fi
exit 0
endef

define Package/luci-app-wlmbstart/install
	$(INSTALL_DIR) $(1)
	$(CP) ./root/. $(1)/
	$(INSTALL_DIR) $(1)/usr/share/luci-app-wlmbstart
	$(INSTALL_DATA) ./LICENSE $(1)/usr/share/luci-app-wlmbstart/LICENSE
	$(CP) ./LICENSES $(1)/usr/share/luci-app-wlmbstart/
endef

$(eval $(call BuildPackage,luci-app-wlmbstart))
