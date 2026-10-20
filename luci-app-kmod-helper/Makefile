include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-kmod-helper
PKG_VERSION:=1.0.0
PKG_RELEASE:=2

PKG_LICENSE:=MIT
PKG_MAINTAINER:=zhtut

LUCI_TITLE:=LuCI Kernel Module Helper
LUCI_DESCRIPTION:=Helps install kmod kernel modules from mirror repositories. Useful when installing packages that depend on kernel modules with mismatched vermagic hash.
LUCI_DEPENDS:=+rpcd +uclient-fetch +wget-ssl +jshn +libubox-lua +ca-bundle
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
