# 翻译术语表（zh 本地化统一口径）

本文件是翻译工作的**唯一术语来源**。所有新增中文必须遵循此表，否则同一概念会在
不同页面出现不同译法。表中的译法来自仓库**已有**的中文目录（`src/i18n/messages/zh.ts`），
不是新拟的——这样新译文与既有界面天然一致。

## 括号与排版规则

### 括号

- **括号内是纯拉丁/技术内容 → 用半角 `()`**：`(APT)`、`(SSO)`、`(Zypper)`、`(netbird proxy)`、`(fra1)`
- **括号内含任何中文 → 用全角 `（）`**：`（可选）`、`（例如服务器、数据库）`

原因：目录里原本两种混用（全角 44 处、半角 37 处），同一界面出现两种风格。
半角那批本来就是对的——拉丁内容配拉丁括号。而且全角括号更宽，中文标签本来就比
英文长，`(APT)`、`(Zypper)` 这类会把设置项的标签挤过英文宽度。
已用 `tools/normalize-cjk-brackets.mjs` 统一。

### 中英之间的空格

半角括号贴着中文时**两侧都要留空格**：`嵌入式代理 (netbird proxy) 的代理集群`，
不能写成 `代理(netbird proxy)的`。全角括号自带边距，不需要空格。

### 布局：中文比英文宽

同一字号下中文更宽，且**没有词边界、不能在词间断行**。凡是按英文字符串定的固定宽度
都可能出问题。已提供 `useIsCjkLocale()`（`src/hooks/useIsCjkLocale.ts`）供组件判断
当前是否为中文，从而：

- 放宽固定宽度（如 DeviceCard 230px → 268px、证书标签 200px → 240px）
- 关掉只对拉丁字母有意义的排版手段：`uppercase`（对中文无效）、`tracking-wider`
  （把中文字距撑开却不增加可读性）、10px 小字（中文比拉丁更难认）
- **不要给中文用 `font-mono`**：等宽字体没有中文覆盖，会回退到系统字体并丢失对齐

审计工具：`node tools/audit-cjk-layout.mjs`（按 class 找固定尺寸）、
`node tools/audit-label-widths.mjs`（按文案宽度找超长标签）。

## 用法

1. 翻译前先查本表。
2. 表里有的，**必须**照用（例如 `Peer` 一律 `节点`，不能写成"对等体""同伴"）。
3. 表里没有的新概念，按"翻译风格"一节的规则处理，并**在本文件追加一行**，方便后续统一。
4. 大小写/单复数不同视为同一术语（`Policies` → `策略`）。

---

## 核心概念（必须照用）

| English | 中文 | 说明 |
| --- | --- | --- |
| Peer | 节点 | **不是**"对等体" |
| Group | 组 | |
| Network | 网络 | |
| Network Route / Route | 网络路由 / 路由 | |
| Policy / Policies | 策略 | |
| Posture Check | 态势检查 | |
| Setup Key | 安装密钥 | |
| Service User | 服务用户 | |
| User | 用户 | |
| Resource | 资源 | |
| Nameserver | 名称服务器 | |
| DNS Zone | DNS 区域 | |
| Domain | 域名 | |
| Cluster | 集群 | **译作集群**（见下方说明） |
| Identity Provider | Identity Provider | **保留英文**（缩略 IDP） |
| Integration | Integration | **保留英文** |
| Reverse Proxy | 反向代理 | |
| Role | 角色 | |
| Status | 状态 | |
| Enabled / Disabled | 已启用 / 已禁用 | |
| Active | 活跃 | |
| Port | 端口 | |
| Protocol | 协议 | |
| Metric | 度量值 | |
| Rule | 规则 | |
| Action | 动作 | |
| Tag | 标签 | |
| Routing Peer | 路由节点 | |
| Access Control | 访问控制 | |
| Audit / Activity | 审计 / 活动 | |

## 常用动词/操作（必须照用）

| English | 中文 |
| --- | --- |
| Create | 创建 |
| Edit | 编辑 |
| Delete | 删除 |
| Save / Save Changes | 保存 / 保存更改 |
| Cancel | 取消 |
| Update | 更新 |
| Remove | 移除 |
| Add | 添加 |
| Enable / Disable | 启用 / 禁用 |
| Search | 搜索 |
| Refresh | 刷新 |
| Copy | 复制 |
| Close | 关闭 |
| Confirm | 确认 |
| Continue | 继续 |
| Back | 返回 |
| Next | 下一步 |
| Finish | 完成 |
| Learn more | 了解更多 |
| Retry | 重试 |
| Download | 下载 |
| Upload | 上传 |

## 状态与提示

| English | 中文 |
| --- | --- |
| Loading... | 加载中... |
| Success / Successfully | 成功 / 成功 |
| Error | 错误 |
| Warning | 警告 |
| Required | 必填 |
| Optional | 可选 |
| Enabled / Disabled | 已启用 / 已禁用 |
| Connected / Disconnected | 已连接 / 未连接 |
| Online / Offline | 在线 / 离线 |
| Pending | 待处理 |
| Expired | 已过期 |
| Never | 从未 |
| Unknown | 未知 |
| Unnamed | 未命名 |

## 保留英文不译

以下属于产品名、协议名、技术缩写，**保留原文**：
- 产品/品牌：`NetBird`、`NetBird Cloud`、`Cluster`、`Integration`、`Identity Provider`/`IDP`
- 协议/技术：`SSH`、`RDP`、`DNS`、`API`、`JWT`、`OIDC`、`SAML`、`SCIM`、`OAuth`、`MFA`、`TLS`、`SSO`、`HTTP`/`HTTPS`、`TCP`/`UDP`、`ICMP`、`CIDR`、`IP`/`IPv4`/`IPv6`、`MAC`、`ACL`、`EDR`、`VPN`、`WireGuard`、`STUN`、`TURN`、`gRPC`、`WebSocket`、`WASM`
- 第三方厂商：`Okta`、`Entra ID`、`Azure AD`、`Google Workspace`、`JumpCloud`、`CrowdStrike`、`SentinelOne`、`FleetDM`、`Huntress`、`Intune`、`Datadog`、`Firehose`、`S3`、`Slack`、`Webhook`、`Grafana`、`Sentry`、`BigQuery` 等
- 计费术语保留英文或按行业习惯：`Billing`（计费）、`Plan`（套餐）、`Subscription`（订阅）

## 标点与格式

- 中文句子用**中文标点**：`，。：；？！（）`
- **不要**在中文里用半角逗号 `,` 或句号 `.`
- 中英文混排时，英文词与中文之间**不加空格**（如 `启用 SSH 访问`——保留技术缩写两侧的自然间距，若缩写在句首或句尾则不加）
- 省略号用中文三连点 `...`（与既有目录一致，不用 `……`）
- 保持与英文相同的**变量插值占位符**：`{name}`、`{count}`、`{setting}` 等，一个都不能改
- ICU 复数：中文没有复数变化，`{count} 个节点` 即可；**保留 ICU 结构**若英文用了复数：
  `"{count, plural, one {# Policy} other {# Policies}}"` → `"{count, plural, one {# 个策略} other {# 个策略}}"`

## 翻译风格

1. **简洁**：界面按钮尽量 2–4 字（`Save Changes` → `保存更改`，不是"保存您所做的更改"）。
2. **主动语态**：`Failed to delete peer` → `删除节点失败`（不是"节点删除被失败"）。
3. **一致**：同一英文词在同一上下文必须同译。
4. **不逐字直译**：`Get started with NetBird` → `开始使用 NetBird`（自然），不是"得到开始与 NetBird"。
5. **技术准确性优先于文学性**：宁可用行业通用说法。
6. **占位符与标签**：保留 `\n`、`<b>`、`<code>` 等富文本标签原样（`t.rich()` 用）。

## 待补充（遇到新概念请追加到上表）

### 关于「Cluster」的裁决（2026-10-12 定案）

本表早期版本写的是「保留英文」，与仓库实际情况矛盾：迁移后的中文目录里
**52 处用「集群」**，只有少数几处残留英文，且那几处是不一致的个例。
因此裁决为 **统一译作「集群」**（代理集群、自托管集群、集群名称…），
理由是该词在中文技术语境中有稳定对应，且仓库既有多数用法已经如此。
Cluster 仅在作为 API 字段值或用户输入回显时保留原文。

> 本轮已修掉 4 处残留：proxyClusters、searchClusterPlaceholder、
> everseProxyClusterRequired、
oActiveProxyClusters。
> 若后续发现新的不一致，以「集群」为准。
