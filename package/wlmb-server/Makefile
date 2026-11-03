include $(TOPDIR)/rules.mk

PKG_NAME:=wlmb-server
PKG_VERSION:=1.1.5
PKG_RELEASE:=1
PKG_SOURCE:=wlmb-server-$(PKG_VERSION)-aarch64_generic.ipk
PKG_SOURCE_URL:=https://github.com/SlAlot/wlmb-server/releases/download/v$(PKG_VERSION)
PKG_HASH:=9ad400f64b83203b9d298b195d661d9feebadb38c967a6f860523aa539606c26
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
