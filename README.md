# NetBird 仪表盘 · 简体中文本地化分支

[NetBird](https://github.com/netbirdio/netbird) 管理面板的前端。本仓库是
[`netbirdio/dashboard`](https://github.com/netbirdio/dashboard) 的 fork，在完全保留上游代码的
前提下加了一层简体中文界面。

无需改服务端，无需重新编译 NetBird，装一个容器即可。

| 项目 | 值 |
| --- | --- |
| 当前同步的上游版本 | `v2.99.0`（`25ae2e15`） |
| 与上游 `main` 的差异 | **0 落后 / 115 领先**（领先部分全部是本地化） |
| 镜像 | `ghcr.io/supportspark/dashboard:zh-latest` |
| 支持架构 | `linux/amd64`、`linux/arm64` |
| 公开性 | 镜像公开，拉取不需要登录 GHCR |
| 许可证 | AGPL-3.0（与上游一致） |
| 技术栈 | Next.js 16.4.6 · React 19.3.1 · Tailwind CSS v4.3 · next-intl 4.14 · React Flow |

> 安装细节、慢网络绕行、自己维护一份的完整步骤见
> **[docs/INSTALL-ZH.md](docs/INSTALL-ZH.md)**；同步机制与冲突处理规则见
> **[docs/I18N-SYNC.md](docs/I18N-SYNC.md)**；术语对照见
> **[docs/I18N-GLOSSARY.md](docs/I18N-GLOSSARY.md)**。

---

## 一、这个分支是什么

仓库只有两个长期分支，职责互不重叠：

| 分支 | 角色 | 是否可直接部署 |
| --- | --- | --- |
| `main` | 上游 `netbirdio/dashboard` 的纯净镜像，逐字节一致，只做快进 | 可以，但没有中文 |
| **`i18n-zh`** | **默认分支**，上游代码 + 中文本地化层 | 可以，中文界面 |

`i18n-zh` 的改动**只有两类**：`useTranslations()` 接线和 `en.ts` / `zh.ts` 两份目录。
逻辑、结构、新功能、重构、bug 修复一律照抄上游。这条规则是硬约束，它保证：

- 上游每次发版都能低摩擦合入；
- 出问题时可以直接切回官方镜像比对，不怀疑"是不是魔改过"。

默认分支之所以设在 `i18n-zh`，是因为 GitHub 只在默认分支上运行 `schedule` 触发的
工作流——定时同步要真正跑起来，只能这样。

---

## 二、翻译覆盖了什么

**已覆盖**：仪表盘容器内渲染的全部界面，包括侧边栏、节点与用户管理、访问控制策略、
网络与路由、DNS、反向代理、Agent Network、集成与设置、活动日志、空状态、表单校验
提示、tooltip、无障碍标签，以及时间格式（中文界面下绝对时间显示为
`2026年11月20日 21:10`，相对时间显示"3 天前"）。

**未覆盖**，且**不在本仓库能解决的范围**内：

| 页面 | 原因 |
| --- | --- |
| 登录页 `/oauth2/auth/local/login` | 由 `netbirdio/netbird-server` 服务端渲染，文案编译在其二进制里 |
| 退出登录页 `/oauth2/logout` | 同上 |

这两页属于另一个容器。要翻译它们得改 NetBird 服务端，不属于本 fork 的职责。

**语言切换**：右上角地球图标，或「设置 → 语言」。选择记在 `NEXT_LOCALE` cookie 里，
优先级是 cookie → 浏览器语言 → 默认值。英文是原始界面，随时可切回。

---

## 三、安装

### 前置条件

- 已用官方 compose 部署过 NetBird（`/opt/netbird` 下有 `docker-compose.yml` 和
  `dashboard.env`）；
- 能访问 `ghcr.io`。若所在网络拉取极慢，看第四节。

### 步骤

```bash
cd /opt/netbird

# 1. 取覆盖文件
curl -fsSLO https://raw.githubusercontent.com/SupportSpark/dashboard/i18n-zh/docker-compose.i18n.yml

# 2. 用主 compose + 覆盖文件启动 dashboard
docker compose -f docker-compose.yml -f docker-compose.i18n.yml up -d dashboard
```

覆盖文件只替换 `dashboard` 服务的镜像，`traefik`、`acme`、`netbird-server` 保持原样；
网络与 label 沿用主 compose，路由行为不变。

打开面板，点右上角地球图标选择「简体中文」。

### 回滚到官方英文版

```bash
docker compose up -d dashboard        # 只带主 compose 文件即可
```

### 升级到新版本

```bash
docker compose -f docker-compose.yml -f docker-compose.i18n.yml pull dashboard
docker compose -f docker-compose.yml -f docker-compose.i18n.yml up -d dashboard
```

> **升级后请硬刷新**（`Ctrl+Shift+R` / `Cmd+Shift+R`）。版本号在构建时被写进 JS
> bundle，已经打开的页面不会自己去问服务器要新版本，会一直显示旧号。

---

## 四、拉取慢怎么办（中国大陆常见）

GHCR 的国际链路经常只有十几到几十 KB/s，一个镜像可能拉半小时以上。三种办法，
按推荐顺序：

**1) 断点续传**——Docker 会保留已下载的层，直接重跑 pull 即可，不用清缓存。

**2) 换时段**——实测同一台机器不同时段能从 14 KB/s 波动到 177 KB/s。

**3) 在有速度的机器上构建/导出再搬运**：

```bash
# 有速度的机器
git clone https://github.com/SupportSpark/dashboard.git
cd dashboard && git checkout i18n-zh
docker build -f docker/Dockerfile -t netbird-dashboard-zh:local .
docker save netbird-dashboard-zh:local | gzip > zh.tar.gz

# 目标服务器
gunzip -c zh.tar.gz | docker load
# 然后把 docker-compose.i18n.yml 里的 image 改成 netbird-dashboard-zh:local
```

公共镜像加速站（DaoCloud、南大等）对本镜像无效，它们只转发白名单内的镜像。

---

## 五、自己构建镜像

```bash
git clone https://github.com/SupportSpark/dashboard.git
cd dashboard
git checkout i18n-zh
docker build -f docker/Dockerfile -t netbird-dashboard-zh:local .
```

镜像内的版本号由 `NEXT_PUBLIC_DASHBOARD_VERSION` 决定。官方镜像由
`.github/workflows/build-localized.yml` 自动构建：它取**可达的最高版本 tag** 加提交短
哈希（例如 `2.98.0+2ef1b69`），推成 `zh-latest`。若手工构建不传这个变量，侧边栏会
显示 `development`。

---

## 六、本地开发

```bash
npm install
npm run dev          # http://localhost:3000
```

开发环境读取仓库根目录的 **`.local-config.json`**（`tsconfig.json` 把 `@/config/local`
映射到它；生产构建则映射到 `config.json`）。内容形如 `config.json`，把
`$NETBIRD_MGMT_API_ENDPOINT`、`$AUTH_AUTHORITY` 这类占位符换成真实值。CI 里会写一个
`{}` 占位，所以本地至少要有一份可用配置才能登入。

常用脚本：

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发服务器（3000） |
| `npm run build` | 生产构建（静态导出到 `out/`） |
| `npm run test:unit` | 单元测试（Vitest） |
| `npm run test:i18n` | 语言探测断言（独立脚本，不在 vitest 收集范围内） |
| `npm run test` | 端到端测试（Playwright，需先 `npm run test:setup` 起 Docker 环境） |
| `npm run storybook` | Storybook（6006） |
| `npm run test:visual` | 视觉回归 |

> 注意：`npm run lint` 会报出大量与本地化改动无关的既有错误（上游 ESLint 配置与本仓库
> 现状不匹配），不要拿它当门禁；类型检查请用
> `node node_modules/typescript/bin/tsc --noEmit` 或 `npm run build`。

---

## 七、翻译是怎么组织的

```
src/i18n/
├── messages/en.ts     # 英文目录（同时也是类型来源）
├── messages/zh.ts     # 中文目录，必须与 en.ts 键完全相同
├── global.d.ts        # 从 en.ts 推导全局 IntlMessages 类型
├── config.ts          # 支持的语言、默认语言、cookie 名
├── detection.ts       # cookie → 浏览器语言 → 默认值
├── request.ts         # next-intl 的 request 配置
└── detection.test.ts
```

规则只有三条，但都是硬的：

1. **`en.ts` 与 `zh.ts` 必须同增同改**。`global.d.ts` 从 `en.ts` 推导 `IntlMessages`，
   所以 `en.ts` 有、`zh.ts` 没有的键会让 `tsc` 直接失败。
2. **新增文案走片段文件**：把键值写进 `i18n-fragments/<名字>.json`，然后
   `node tools/merge-i18n-fragments.mjs`。合并器是加法式的，遇到"同键不同值"会报错而
   不是悄悄覆盖。
3. **改已有键的值**（例如上游改了英文措辞）直接改 `en.ts` / `zh.ts`，不要新建同名片段。

非 React 场景（工具函数、非组件模块）不要硬塞 hook，按已有惯例接一个可选翻译器参数：

```ts
export function formatDenyReason(
  reason: string | undefined,
  t?: (key: string, values?: any) => string,
): string {
  // 有 t 走目录，没有 t 返回英文字面量——上游的测试因此保持绿色
}
```

这个模式（`formatDenyReason`、`formatErrorReason`）的好处是：上游测试不传 `t` 也能跑，
我们的界面有 `t` 时走中文。

---

## 八、质量门禁

这些检查全部接进了 CI（`.github/workflows/i18n-parity.yml`），本地也建议跑一遍：

```bash
node node_modules/typescript/bin/tsc --noEmit       # 类型（含 zh.ts 缺键）
npm run test:unit                                   # 单元测试
npm run build                                       # 生产构建 + 静态导出
node tools/check-catalog-parity.mjs .               # en/zh 键一致性
node tools/check-translation-keys.mjs               # t("key") 是否都能在绑定命名空间解析
node tools/check-message-rendering.mjs              # 消息编排 + t.rich 标签齐备
node tools/check-indentation.mjs .                  # 禁止 Tab 缩进
node tools/find-dropped-upstream-code.mjs           # 合并时是否丢了上游代码
pwsh -File tools/check-merge-integrity.ps1          # 冲突标记、i18n 接线、依赖完整性
```

还有一个**只报告不失败**的工具，用来找漏翻：

```bash
node tools/check-english-fidelity.mjs     # 列出仍以英文渲染的界面文字
```

它会报出一批误报（JSX 表达式与 ICU 消息的比对限制造成），看趋势而不是看绝对值。

`tools/` 下另有若干一次性审计脚本（`audit-cjk-layout.mjs`、`find-hardcoded-english.mjs`、
`find-dead-keys.mjs` 等），用于排查排版、硬编码文案和死键。

---

## 九、跟进上游

### 手动

```bash
git fetch upstream --tags
git merge upstream/main          # 在 i18n-zh 上
```

### 自动

`.github/workflows/sync-upstream.yml` 定时尝试把上游新的 release tag 合进 `i18n-zh`。
合得上就推，合不上就**中止并在运行摘要里报告**，不猜、不硬合。

### 冲突怎么解

上游赢在一切非翻译物：

| 上游改了什么 | 我们怎么办 |
| --- | --- |
| 新增/重构 JSX、props、逻辑、className | 照抄上游 |
| 同一行里既有文案又有改动 | 取上游结构 + 保留 `t()` |
| 删掉了某段 UI | 让它删，连同我们的 `t()` 一起 |
| 改了 props 名（`label` → `text`） | 用上游的名字，值仍用 `t()` |
| 导入冲突 | 取并集，再删掉解析后不再使用的 |
| **新增**一句文案 | 这是唯一需要我们来做的：加 key + 翻译 |

`docs/I18N-SYNC.md` 里有完整的冲突类型清单和历史上的判断记录。

---

## 十、部署与运维工具

仓库里带了几个本分支特有的运维脚本，都是在真实环境跑过的：

| 文件 | 作用 |
| --- | --- |
| `tools/zero-downtime-deploy.sh` | 覆盖式重建 dashboard，验证新容器健康后再切，失败回滚 |
| `tools/vps-auto-update.sh` | 每小时检查上游 release，自动升级 server/dashboard，健康检查不过自动回退 |
| `tools/netbird-auto-update.service` / `.timer` | 上面脚本的 systemd 单元 |
| `docker-compose.i18n.yml` | 覆盖文件，额外加了 Traefik 重试中间件与主动健康探测 |

零中断的关键在两个 label：`retry.attempts`（注意不是 `retries`，写错会导致整个
router 被丢弃、全站 404）和 `loadbalancer.healthcheck`。细节写在覆盖文件的注释里。

---

## 十一、常见问题

**升级后侧边栏还显示旧版本号？**
bundle 没换。硬刷新，或关掉标签页重开。版本号是构建时常量，运行期不会重新查询。

**侧边栏显示 `development`？**
镜像构建时没传 `NEXT_PUBLIC_DASHBOARD_VERSION`。自己构建时加上即可。

**版本号比上游 release 低一档？**
构建发生在打 tag 之前。上游可能在你合并之后才发布同一个提交的 tag；重新构建一次就会
跟上（版本号取自构建那一刻存在的最高可达 tag）。

**界面还是英文？**
点地球图标切换；或清掉 `NEXT_LOCALE` cookie 让它重新探测；或检查浏览器语言。

**某些功能菜单看不到？**
EDR/MDM 集成、SCIM、流量事件、事件流等需要 NetBird 商业许可，社区版服务端本身没有
这些端点，与语言无关。排查记录见 [docs/LICENSE-GATE-MAP.md](docs/LICENSE-GATE-MAP.md)。

**登录页是英文，能翻译吗？**
不能——那是 `netbird-server` 服务端渲染的，不在本仓库范围内（见第二节）。

---

## 十二、上游信息

- 上游仓库：[netbirdio/dashboard](https://github.com/netbirdio/dashboard)
- 托管版：<https://app.netbird.io/>
- NetBird 主仓库：[netbirdio/netbird](https://github.com/netbirdio/netbird)

### 反馈

上游采用「先讨论、后 issue」的流程，本 fork 沿用同一渠道：

| 想做什么 | 去哪里 |
| --- | --- |
| 报告 bug、回归、异常行为 | [Issue Triage](https://github.com/netbirdio/netbird/discussions/new?category=issue-triage) |
| 提需求、聊想法 | [Ideas & Feature Requests](https://github.com/netbirdio/netbird/discussions/new?category=ideas-feature-requests) |
| 问部署、配置、自托管 | [Q&A / Support](https://github.com/netbirdio/netbird/discussions/new?category=q-a-support) |
| 报告安全漏洞 | [Security policy](https://github.com/netbirdio/netbird/security/policy)，不要公开发帖 |

**翻译问题**（错译、漏译、措辞别扭）请直接在本仓库开 issue，并附上页面路径、
界面语言和截图。

### 上游技术栈

Next.js · React · Tailwind CSS · [React Flow](https://reactflow.dev/)（控制中心拓扑图）·
next-intl（本分支新增）· Nginx · Docker · Let's Encrypt

### 从旧版仪表盘（v1）迁移

```bash
docker compose down dashboard
# 把 docker-compose.yml 里的镜像名改成 netbirdio/dashboard:main
docker compose up -d --force-recreate dashboard
```

用本分支时把镜像名换成 `ghcr.io/supportspark/dashboard:zh-latest`，或按第三节用覆盖文件。

---

## 十三、许可证

AGPL-3.0，与上游一致。**对外提供网络服务时须履行 AGPL 的源码提供义务**——本仓库的
修改本身就是公开的，正常使用不会带来额外负担。
