# luci-app-kmod-helper（内核模块助手）

一个 OpenWrt / ImmortalWrt 的 LuCI 插件，帮助用户从镜像仓库方便地安装 kmod 内核模块。

## 解决什么问题

很多固件在安装第三方插件时，会因为缺少对应的 kmod 内核模块、或内核 vermagic hash 不匹配，导致 opkg/apk 依赖检查失败，插件装不上。本插件：

- 自动识别设备的固件版本、target/subtarget、内核版本和 vermagic
- 从镜像站（默认北大源）定位与你内核匹配的 kmod 目录
- 支持搜索并按需强制安装（`--nodeps` / `--force-depends`），跳过 vermagic 检查

## 功能

| 页面 | 功能 |
|---|---|
| 概览 | 展示设备型号、固件版本、target/subtarget、内核版本、vermagic、包管理器类型 |
| 镜像源设置 | 预设北大源，支持自定义镜像，**保存后立即生效**（无需重启/刷新） |
| 安装内核模块 | 自动匹配内核目录（精确 vermagic → 同版本最新 → 兜底最新），搜索 kmod，一键强制安装 |
| 已安装内核模块 | 列出所有 `kmod-*` 包，可卸载（带警告） |
| 内核工具 | lsmod 已加载模块、modinfo 查询、dmesg 内核日志 |
| 运行日志 | 前端会话日志 + 设备端日志（`/tmp/kmod-helper.log`），可一键下载用于排障 |

## 内核目录匹配逻辑

镜像 URL 规则：
```
{mirror}/releases/{version}/targets/{target}/{subtarget}/kmods/
```

- **Release 版本**（如 `25.12.1`）：镜像站通常只有一个 `kmods/<vermagic>/` 目录，直接精确匹配
- **Snapshot 版本**（如 `24.10-SNAPSHOT`）：可能存在多个内核目录，按以下顺序匹配：
  1. 与当前 vermagic 完全一致（如 `6.12.94-1-b5b7729ff...`）
  2. 与当前内核大版本（如 `6.6.x`）匹配的最新目录
  3. 兜底使用最新目录（可手动下拉选择任意目录）

## 包管理器兼容

| 包管理器 | 强制安装参数 |
|---|---|
| opkg | `opkg install --nodeps` |
| apk (OpenWrt 24.10+) | `apk add --force-depends`（失败时回退 `--force-non-repository`） |

自动探测当前系统使用哪种包管理器。

## 目录结构

```
luci-app-kmod-helper/
├── Makefile
├── htdocs/luci-static/resources/
│   ├── kmod_helper_log.js                     # 前端会话日志模块
│   └── view/kmod-helper/
│       ├── overview.js     # 概览
│       ├── mirror.js       # 镜像源设置
│       ├── install.js      # 搜索与安装（核心）
│       ├── installed.js    # 已安装列表
│       ├── tools.js        # 内核工具
│       └── logs.js         # 运行日志
├── root/
│   ├── etc/config/kmod_helper                 # UCI 配置
│   ├── etc/uci-defaults/90-luci-app-kmod-helper
│   ├── usr/libexec/rpcd/luci.kmod-helper      # rpcd 后端（ubus 服务）
│   ├── usr/share/luci/menu.d/                 # 菜单注册（系统菜单下）
│   └── usr/share/rpcd/acl.d/                  # ACL 权限
└── po/zh_Hans/kmod-helper.po                  # 简体中文翻译
```

## 编译

将本目录放入 OpenWrt/ImmortalWrt 源码树的 `package/` 下，然后：

```sh
./scripts/feeds update -a
./scripts/feeds install -a
make menuconfig        # 在 LuCI -> Applications 中选中 luci-app-kmod-helper
make package/luci-app-kmod-helper/compile V=s
```

生成的 `.ipk` 位于 `bin/packages/<arch>/luci/`。

## 安装

```sh
opkg install luci-app-kmod-helper_1.0.0-1_all.ipk
# 或 apk 系统
apk add --allow-untrusted luci-app-kmod-helper-1.0.0-r1.apk
```

安装后刷新 LuCI，在 **系统（System）→ 内核模块助手（Kernel Module Helper）** 下即可看到。

## 默认镜像源

北大镜像站：`https://mirrors.pku.edu.cn/immortalwrt/`

可在「镜像源设置」页切换为自定义镜像，保存后**立即生效**。

## 排障与运行日志

所有后端行为（每次 ubus 调用、参数、镜像站抓取的 URL/返回码/错误、opkg/apk 命令输出）
都会记录到设备上的 `/tmp/kmod-helper.log`（超过 128KB 自动轮转）；前端的点击与 rpc
调用记录在浏览器会话中。在 **运行日志** 页可查看两者并一键下载成 txt 文件，反馈问题
时附上即可。

也可以在设备上直接查看：

```sh
cat /tmp/kmod-helper.log
```

## 开发注意：换行符

仓库通过 `.gitattributes` 强制所有文本文件使用 LF。`root/usr/libexec/rpcd/luci.kmod-helper`
是 shell 脚本，一旦变成 CRLF，每条命令名都会带上 `\r`（如 `json_dump\r` → not found），
导致所有 ubus 调用返回空对象（页面表现为设备信息全为 `-`、镜像源测试失败等）。
切勿在 Windows 下用会写 CRLF 的工具保存该文件。

## License

MIT
