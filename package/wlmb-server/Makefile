include $(TOPDIR)/rules.mk

PKG_NAME:=wlmb-server
PKG_VERSION:=1.1.6
PKG_RELEASE:=2
PKG_SOURCE:=wlmb-server-$(PKG_VERSION)-aarch64_generic.ipk
PKG_SOURCE_URL:=https://github.com/SlAlot/wlmb-server/releases/download/v$(PKG_VERSION)
PKG_HASH:=c4cb5f7c796eb411e7db5865124ddc49255e0d7723088c4fb6ff488a73a524f6
PKG_LICENSE:=LicenseRef-WLMB-NonCommercial
PKG_MAINTAINER:=SlAlot

include $(INCLUDE_DIR)/package.mk

define Package/wlmb-server
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Network Panel by SlAlot
  URL:=https://github.com/SlAlot/wlmb-server
  DEPENDS:=@aarch64 +rpcd +rpcd-mod-iwinfo +luci-base +uci +swrt-pcat-manager +jq-full
endef

define Package/wlmb-server/description
  Integrates the author's checksum-pinned ARM64 musl release into the
  firmware's native package database, retaining its UI and license notices.
endef

define Package/wlmb-server/conffiles
/etc/config/network_panel
endef

define Build/Prepare
	$(INSTALL_DIR) $(PKG_BUILD_DIR)/payload
	tar -xOf $(DL_DIR)/$(PKG_SOURCE) data.tar.gz | tar -xz -C $(PKG_BUILD_DIR)/payload
	patch --batch --forward -p1 -d $(PKG_BUILD_DIR)/payload < $(CURDIR)/files/swrt-panel.patch
	test -x $(PKG_BUILD_DIR)/payload/usr/sbin/wlmb-server
	test -f $(PKG_BUILD_DIR)/payload/usr/share/wlmb-server/LICENSE
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/wlmb-server/install
	$(CP) $(PKG_BUILD_DIR)/payload/. $(1)/
	$(INSTALL_DIR) $(1)/usr/libexec $(1)/etc/init.d
	$(INSTALL_BIN) ./files/swrt-wlmb-battery $(1)/usr/libexec/swrt-wlmb-battery
	$(INSTALL_BIN) ./files/swrt-wlmb-battery.init $(1)/etc/init.d/swrt-wlmb-battery
endef

$(eval $(call BuildPackage,wlmb-server))
