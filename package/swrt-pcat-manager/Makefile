include $(TOPDIR)/rules.mk

PKG_NAME:=swrt-pcat-manager
PKG_VERSION:=2026.10.25
PKG_RELEASE:=1
PCAT_COMMIT:=0e61a4abf35c423420310311f1b2b059deba0cac
PKG_SOURCE:=$(PCAT_COMMIT).tar.gz
PKG_SOURCE_URL:=https://github.com/photonicat/rockchip_rk3568_pcat_manager/archive
PKG_HASH:=9ea7890bba5a36d52104e9fa873c29dc7389303f3092d8b7bf6d42d720017b63
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
  CONFLICTS:=pcat-mgr pcat-manager pcat-manager-v1
  URL:=https://github.com/photonicat/rockchip_rk3568_pcat_manager/tree/master
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
	$(INSTALL_BIN) ./files/swrt-power-migrate $(1)/usr/libexec/swrt-power-migrate
	$(INSTALL_CONF) $(PKG_BUILD_DIR)/conf/pcat-manager.conf.sample $(1)/etc/pcat-manager.conf
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/conf/pcat-manager.conf.sample $(1)/usr/share/swrt-pcat-manager/official-v1.conf
	$(INSTALL_DATA) ./files/legacy-v1.conf $(1)/usr/share/swrt-pcat-manager/legacy-v1.conf
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/LICENSE $(1)/usr/share/swrt-pcat-manager/LICENSE.upstream
endef

$(eval $(call BuildPackage,swrt-pcat-manager))
