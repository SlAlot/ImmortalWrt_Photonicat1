include $(TOPDIR)/rules.mk

PKG_NAME:=swrt-pcat-manager
PKG_VERSION:=2025.08.18
PKG_RELEASE:=2
PCAT_COMMIT:=6f16e4ab4fbba220af932e02e5ef8f1a63f4bafd
PKG_SOURCE:=$(PCAT_COMMIT).tar.gz
PKG_SOURCE_URL:=https://github.com/photonicat/rockchip_rk3568_pcat_manager/archive
PKG_HASH:=d79f13b0151b5a07ef31795899bbf5a4a9e2ee66327a9d8347290aa12574fe3a
PKG_BUILD_DIR:=$(BUILD_DIR)/rockchip_rk3568_pcat_manager-$(PCAT_COMMIT)
PKG_LICENSE:=GPL-3.0-only AND AGPL-3.0-only
PKG_INSTALL:=1

include $(INCLUDE_DIR)/package.mk
include $(INCLUDE_DIR)/nls.mk
include $(INCLUDE_DIR)/meson.mk

define Package/swrt-pcat-manager
  SECTION:=utils
  CATEGORY:=Utilities
  TITLE:=SWRT Photonicat 1 power service
  DEPENDS:=@TARGET_rockchip_armv8 +glib2 +libjson-c
  CONFLICTS:=pcat-mgr pcat-manager kmod-photonicat-pm
  URL:=https://github.com/photonicat/rockchip_rk3568_pcat_manager/tree/v1
endef

define Package/swrt-pcat-manager/conffiles
/etc/pcat-manager.conf
/etc/pcat-manager-userdata.conf
endef

define Build/Prepare
	$(call Build/Prepare/Default)
	python3 ./files/prepare-source.py $(PKG_BUILD_DIR)
	$(CP) ./files/power-client.c $(PKG_BUILD_DIR)/src/swrt-power-client.c
endef

define Package/swrt-pcat-manager/install
	$(INSTALL_DIR) $(1)/usr/sbin $(1)/usr/libexec $(1)/etc/init.d $(1)/etc $(1)/usr/share/swrt-pcat-manager
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/bin/pcat-manager $(1)/usr/sbin/swrt-pcat-manager
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/bin/swrt-power-client $(1)/usr/libexec/swrt-power
	$(INSTALL_BIN) ./files/swrt-pcat-manager.init $(1)/etc/init.d/swrt-pcat-manager
	$(INSTALL_CONF) $(PKG_BUILD_DIR)/conf/pcat-manager.conf.sample $(1)/etc/pcat-manager.conf
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/LICENSE $(1)/usr/share/swrt-pcat-manager/LICENSE.upstream
endef

$(eval $(call BuildPackage,swrt-pcat-manager))
