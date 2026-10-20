# luci-app-easy-setup 实施计划

> 状态：Phase 1-5 已完成（2026-10-20），待真机验证与 CI 首跑。本文档为开发蓝图，后续继续开发以此为准。
> 约定：沿用 luci-app-kmod-helper 的模式（LuCI JS 视图 + shell rpcd 后端 + ACL/menu JSON + po 翻译，全仓库 LF 行尾）。

## 定位

面向 OpenWrt 新手的「简易设置」插件：最少输入、即点即生效、无待提交状态、无倒计时回退。

## 已确认决策

| 决策点 | 结论 |
|--------|------|
| 插件名 | luci-app-easy-setup，菜单显示「简易设置 / Easy Setup」 |
| 菜单位置 | admin/system 下第一位（order: 1） |
| 交互模型 | 点击按钮 = 立即 uci commit + 重启对应服务；不用 LuCI 保存/应用机制 |
| 回退 | 不做（用户明确接受风险：设错 IP 只能硬件 reset） |
| 模式输入 | 本机新 IP（必填）+ 主路由 IP（自动带出=新 IP 网段 .1，可编辑） |
| 模式后台动作 | 关 LAN DHCP、网关/DNS→主路由 IP、防火墙 input/forward ACCEPT（旁路由与 AP 相同） |
| WiFi | 一份表单（SSID+密码）统一应用到所有频段，加密方式不动 |
| 原生弹窗 | 全部禁用（alert/confirm/LuCI modal 均有主题兼容问题），自研 toast + popover |
| CI | ImmortalWRT 源码，矩阵双 job：openwrt-24.10 分支→.ipk；openwrt-25.10 分支→.apk；kmod-helper 一并编译 |

## 目录结构

```
luci-app-easy-setup/
├── Makefile                                   # luci.mk, LUCI_PKGARCH:=all
├── htdocs/luci-static/resources/
│   ├── view/easy-setup/
│   │   ├── index.js                           # Tab 栏 + 加载器（唯一视图入口）
│   │   ├── tab.basic.js                       # ① 基础：主机名
│   │   ├── tab.password.js                    # ② 密码：管理密码
│   │   ├── tab.lanip.js                       # ③ 局域网 IP：LAN IP
│   │   ├── tab.wifi.js                        # ④ 无线：WiFi 名称/密码（全频段）
│   │   └── tab.mode.js                        # ⑤ 工作模式：一键旁路由 / 一键 AP
│   └── easy-setup/
│       ├── ui.js                              # toast / popover / 校验器（自研组件）
│       └── ui.css                             # 全部样式自带，不依赖主题变量
├── root/
│   ├── usr/libexec/rpcd/luci.easy-setup       # shell + jshn 后端
│   ├── usr/share/rpcd/acl.d/luci-app-easy-setup.json
│   ├── usr/share/luci/menu.d/luci-app-easy-setup.json
│   └── etc/uci-defaults/90-luci-app-easy-setup # chmod + rpcd reload
└── po/zh_Hans/easy-setup.po
```

**Tab 扩展契约**：每个 tab 模块导出 `{ id, title, render(container, current) }`；index.js 按注册表渲染。以后加新功能 = 新增一个 tab 文件 + 注册一行。

## rpcd 后端方法（object: luci.easy-setup）

| 方法 | 参数 | 行为 |
|------|------|------|
| get_current | — | 主机名、LAN IP/掩码/网关、当前默认网关（ip route）、各 wifi-iface SSID/加密 |
| set_hostname | name | 校验 RFC1123 → uci system.@system[0].hostname → commit system |
| set_password | password | 校验长度 → `passwd root`（管道喂两次） |
| set_lan_ip | ip | 校验私网段 → uci network.lan.ipaddr → commit → service network restart |
| set_wifi | ssid, key | 校验 → 遍历 wifi-iface 改 ssid/key → commit wireless → wifi reload（兼容 ubus network.wireless reload） |
| set_mode | mode, lan_ip, gw_ip | 校验两 IP → lan_ip 写入 network.lan.ipaddr；gw_ip 写入 lan gateway+dns；dhcp.@lan[0].ignore=1；防火墙 lan zone input/forward=ACCEPT → commit → 重启 network+firewall+dnsmasq |

所有写方法：**服务端二次校验**（信任边界），返回 `{success:bool, error?:string, detail?:string}`。校验失败返回 success=false + 人话错误。

## 校验规则（前端 ui.js 与后端 shell 各实现一份）

- **私网 IP**（LAN IP / 模式两个 IP 共用）：
  1. 合法 IPv4 点分十进制（每段 0-255）
  2. 必须私网段：192.168.0.0/16、10.0.0.0/8、172.16.0.0~172.31.255.255
  3. /24 语义下末位 ≠ 0 且 ≠ 255
  4. 错误示例文案：「55.1.2.3 不是局域网地址。请填写 192.168.x.x（如 192.168.1.2）或 10.x.x.x 开头的内网 IP」
- **主机名**：1–32 字符，字母/数字/连字符，不以连字符开头结尾（RFC1123）
- **密码**：≥8 位，两次一致（前端比对）
- **SSID**：1–32 字符
- **WiFi 密码**：8–63 字符（WPA-PSK 规范）

## 提示体系（三层 + toast）

1. **placeholder**：框内简要示例（`例如：192.168.1.2`）
2. **helper 文字**：框下常驻说明（合法网段、位数限制、后果）
3. **「?」popover**：label 左侧问号按钮，点击弹自研 popover（点外部关闭），放深入解释（什么是旁路由、改 IP 后为何断线等）
4. **toast**：水平居中靠上悬浮；成功绿 3s / 失败红 5s / 警告黄；带图标、支持多行详情；点击可立即关闭；成功文案要具体（「主机名已改为 X，立即生效」）

## 断线处理（红字横幅，非 toast）

- **改 LAN IP / 模式**：应用成功后立即渲染全屏红底白字横幅「连接已断开…」，用 `new Image()` 探测 `当前协议//新IP:当前端口/` 轮询约 30s：
  - 探测通 → `location.href` 跳转新地址
  - 超时不通 → 横幅追加「请手动在浏览器打开：http(s)://新IP/」
- **改 WiFi**：红字横幅「WiFi 已修改，请连接新的 WiFi「新SSID」后重新打开本页面」+ 显示当前页面完整 URL

## GitHub Workflow：.github/workflows/build.yml

- 触发：push tag `v*`、workflow_dispatch
- 矩阵：`{branch: openwrt-24.10, fmt: ipk}` / `{branch: openwrt-25.10, fmt: apk}`
- 步骤：clone ImmortalWRT 对应分支（浅克隆）→ 缓存 dl/ → feeds update/install → 将仓库根下 luci-app-* 复制进 package/ → 最小 .config（x86/64）→ `make package/luci-app-easy-setup/compile package/luci-app-kmod-helper/compile` → 按扩展名收集产物上传 artifact
- 插件 arch:all，任一 target 编出的产物全平台可装

## 实施阶段

- [x] Phase 1 骨架 + UI 组件：Makefile/菜单/ACL/uci-defaults/rpcd、ui.js+ui.css、index.js Tab 框架
- [x] Phase 2 低风险三 tab：basic(主机名)、password、wifi（三层提示+校验+toast+WiFi 断线横幅）
- [x] Phase 3 网络两 tab：lanip（私网校验+横幅+跳转探测）、mode（旁路由/AP）；rpcd 全部写方法
- [x] Phase 4 CI：build.yml 双格式矩阵（openwrt-24.10→ipk，openwrt-25.10→apk）
- [x] Phase 5 自检：sh -n ✓、shell 校验器 28 项 ✓、JS 校验器 33 项 ✓、node --check ✓、JSON/YAML ✓、po 覆盖 109 串 ✓
  - 修复记录：shell 变量后紧跟中文字符导致变量名解析错误（`$_ip」`→`${_ip}`，macOS bash 3.2 复现，测试捕获）
  - 测试位置：tests/validators.sh（shell）、tests/validators.test.mjs（JS，含 55.x/172.15-16-31/32 边界、.0/.255、前导零）

## 待办（下次继续）

- [ ] 真机安装验证：ipk 装入 ImmortalWRT 设备，过一遍五个 tab 全流程（重点：改 IP 跳转探测、WiFi 断线横幅、模式切换后 DHCP/防火墙状态）
- [ ] CI 首跑：确认 ImmortalWRT 是否存在 openwrt-24.10 / openwrt-25.10 分支名（不存在则改为实际分支名）；确认 25.10 默认产出 .apk
- [ ] 可选：README.md（安装说明 + 截图）

## 风险（已确认接受）

- 无回退：合法但不可达的 IP 无法拦截，设错只能 failsafe reset
- 模式切换关防火墙：设备暴露内网，页面红字警示
- ImmortalWRT 25.10 分支 apk 行为以 CI 首跑为准
- CSS 加载：用 JS 注入 `<link>`（L.resource 路径），24.10/25.10 通吃
