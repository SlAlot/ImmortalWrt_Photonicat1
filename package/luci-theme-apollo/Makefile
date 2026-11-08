include $(TOPDIR)/rules.mk

PKG_NAME:=luci-theme-apollo
PKG_VERSION:=1.0.0
PKG_RELEASE:=4
PKGARCH:=all
PKG_LICENSE:=LicenseRef-WLMB-NonCommercial AND Apache-2.0 AND MIT AND ISC
PKG_MAINTAINER:=SlAlot

include $(INCLUDE_DIR)/package.mk


define Package/luci-theme-apollo
  PKGARCH:=all
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=4. Themes
  TITLE:=Apollo Theme
  DEPENDS:=+luci-base +luci-theme-bootstrap
endef

define Build/Compile
endef

define Package/luci-theme-apollo/postrm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	uci -q delete luci.themes.Apollo
	if [ "$$(uci -q get luci.main.mediaurlbase)" = /luci-static/apollo ]; then
		uci set luci.main.mediaurlbase='/luci-static/bootstrap'
	fi
	uci commit luci
	rm -f /tmp/luci-indexcache /tmp/luci-indexcache.*
}
endef

define Package/luci-theme-apollo/install
	$(INSTALL_DIR) $(1)/www/luci-static/apollo
	$(CP) ./root/. $(1)/
	$(INSTALL_DIR) $(1)/usr/share/luci-theme-apollo
	$(INSTALL_DATA) ./LICENSE $(1)/usr/share/luci-theme-apollo/LICENSE
	$(CP) ./LICENSES $(1)/usr/share/luci-theme-apollo/
	chmod 755 $(1)/etc/uci-defaults/95-apollo-theme
endef

$(eval $(call BuildPackage,luci-theme-apollo))
