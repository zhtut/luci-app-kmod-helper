include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-easy-setup
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_LICENSE:=MIT
PKG_MAINTAINER:=zhtut

LUCI_TITLE:=LuCI Easy Setup
LUCI_DESCRIPTION:=Beginner-friendly quick setup: hostname, admin password, LAN IP, WiFi name/password, one-click bypass-router and AP mode. Changes apply immediately.
LUCI_DEPENDS:=+rpcd +jshn
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
