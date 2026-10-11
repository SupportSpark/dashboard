# i18n 中文本地化分支 — 维护与上游同步手册

本仓库是 [`netbirdio/dashboard`](https://github.com/netbirdio/dashboard) 的 fork，
在官方代码之上叠加了一层 **next-intl 中英双语本地化**，主要为简体中文服务。

- **fork**：https://github.com/SupportSpark/dashboard（默认分支已设为 `i18n-zh`）
- **本地化分支**：`i18n-zh` ← **部署用的就是这个**
- **上游镜像分支**：`main`（只做快进，不放本地化改动）
- **上游**：`netbirdio/dashboard`（默认分支 `main`）
- **本地化基线**：上游 `v2.90.7` + [`PR #671`](https://github.com/netbirdio/dashboard/pull/671)（作者 `sakuradairong`）的完整实现
- **当前状态**：已同步到上游 `d6241304`（2026-10-09），与上游 `main` 的差异为 **0 落后 / 63 领先**
- **许可证**：AGPL-3.0（与上游一致；对外提供网络服务时须遵守 AGPL 的源码提供义务）

> **为什么把默认分支设为 `i18n-zh`**：GitHub 只在**默认分支**上运行 `schedule`
> 与 `workflow_dispatch` 触发的工作流。这个 fork 存在的意义就是维护本地化分支，
> 所以默认分支指向它，定时同步才能真正自动跑起来。

---

## 0. 现状速查（均已验证）

| 项 | 状态 |
| --- | --- |
| 构建 | ✅ `npm run build` 通过，54 个静态路由预渲染 |
| 单元测试 | ✅ 884/884 通过（70 个文件） |
| 目录一致性 | ✅ en/zh 各 2625 个 key，无缺失、无孤立 |
| key 解析 | ✅ 2221 个命名空间内字面量 key 全部可解析 |
| 语言探测断言 | ✅ `npm run test:i18n` 全通过 |
| CI（parity + 镜像构建） | ✅ 已跑绿 |
| 线上部署 | ✅ `https://1.13.193.126` 返回 200，中文包随镜像下发 |

---

## 1. 为什么要这样搭

上游 `main` 尚未内置 i18n 框架，社区有两个相关 PR：

| PR | 状态 | 规模 | 说明 |
| --- | --- | --- | --- |
| [#671](https://github.com/netbirdio/dashboard/pull/671) | OPEN / CONFLICTING | ~3.2k 行目录，298 文件 | **最完整的 zh-CN 实现**（next-intl）——本分支采用 |
| [#825](https://github.com/netbirdio/dashboard/pull/825) | OPEN / MERGEABLE | 209 条/语言 × 11 语言 | 2026-10 新建，与当前 main 兼容，但覆盖面小得多 |

两者都还没有被上游合并。所以策略是：**以 #671 为本地化内核，自己维护与上游的同步**。

关键结构事实：真正庞大的部分——`src/i18n/messages/en.ts`（3185 行）与
`src/i18n/messages/zh.ts`（3079 行）翻译目录——与上游是**增量式**关系，
在合并上游时**自动干净合并**。冲突几乎全部集中在**调用点改造**：
某个文件被我们改成 `t("…")`、同时上游把这段代码重写了。

这决定了自动化策略：目录文件可以让自动化直接判给本地化侧，调用点必须人来判断。

---

## 2. 分支模型

```
netbirdio/dashboard:main ──(upstream)──┐
                                       │  每日/手动同步
SupportSpark/dashboard                 ▼
   main     = 上游的镜像（只做快进，不放本地化改动）
   i18n-zh  = 本地化分支：上游 main + i18n 层   ← 部署用的就是它
```

**为什么把本地化单独放在 `i18n-zh` 而不是直接改 `main`**：
`main` 保持"上游纯净镜像"后，`git fetch upstream && git merge upstream/main`
永远是一个可预期的动作，冲突只会出现在 `i18n-zh` 上，排查范围小得多。

---

## 3. 自动化流水线

### 3.1 `sync-upstream.yml` — 自动同步

| 项 | 值 |
| --- | --- |
| 触发 | 每天 `03:17 UTC` 定时 + 手动 `workflow_dispatch` |
| 目标 | 默认取**最新上游 release tag**（如 `v2.94.0`），可手动指定任意 ref |
| 动作 | 把该 ref 合并进 `i18n-zh` |
| 安全门 | 合并后**必须**通过 `npm run build` + `npx tsc --noEmit` 才会 push |
| 失败处理 | 冲突 → 自动 `git merge --abort`（分支保持干净）+ 开 issue 列出冲突文件 |

**为什么按 release 同步而不是按 main 的每次 push**：上游 `main` 每天变动多次、
以日常功能开发为主；每次都合会让本地化分支被冲突淹没。release 是我们真正会部署的
单位，所以以 tag 为同步粒度，`workflow_dispatch` 用来随时补同步。

**冲突判归策略**（`Resolve translation-catalog conflicts in our favour` 步骤）：

| 路径 | 判给 | 理由 |
| --- | --- | --- |
| `src/i18n/messages/**`、`src/i18n/config.ts`、`src/i18n/request.ts` | **本地化侧** | 增量式目录，自动化绝不能丢掉中文译文 |
| 其他所有文件 | **停下开 issue** | 这是"上游改结构 + 我们改文案"的语义冲突，只有人能正确判断 |

> ⚠️ 注意：这里**故意没有**用全局 `-X ours`。全局判给本地化侧会静默丢弃上游的
> bug 修复——那正是这个流水线要防止的漂移。

### 3.2 `build-localized.yml` — 构建本地化镜像

`i18n-zh` 每次 push（以及打 `i18n-v*` tag）都会构建并推送镜像到
`ghcr.io/supportspark/dashboard`。

| tag | 含义 |
| --- | --- |
| `i18n-zh` | 分支最新 |
| `zh-latest` | 同上，固定别名 |
| `i18n-v1.0.0` | 打了 tag 的版本 |

构建前会断言 `src/i18n/messages/zh.ts` 非空，防止某次合并意外丢掉目录。

---

## 4. 冲突解决策略（人工同步时照此执行）

**核心原则：上游负责一切非 i18n 的东西，我们只负责 i18n。**

| 冲突内容 | 取谁 |
| --- | --- |
| 逻辑、结构、新功能、新 props/state、重构、bug 修复、import | **上游** |
| `import { useTranslations } from "next-intl"`、`const t = useTranslations("ns")`、`t("key")` / `t.rich(...)` | **本地化侧** |
| 上游新增的用户可见英文文案 | 保留上游英文，之后补 key（见 §5） |
| 上游删掉了我们本地化过的那段代码 | **跟上游删掉** |

典型形态——上游加了新分支，我们曾把那段文案本地化过：

```tsx
// 本地化侧（我们）
<div className={"x"}>{t("updateRequired")}</div>

// 上游
isDisabled ? (
  <div className={"x"}>{disabledPeerReason}</div>
) : (
  <div className={"x"}>
    Please update NetBird to at least <span>v0.36.6</span> or later to use this peer as a routing peer.
  </div>
)

// ✅ 正确解：保留上游的三元与新变量；只在原来那句被本地化的位置用 t()
isDisabled ? (
  <div className={"x"}>{disabledPeerReason}</div>
) : (
  <div className={"x"}>{t("updateRequired")}</div>
)
```

**表格列定义**是一个反复出现的模式：本地化分支把模块级 `columns` 常量改成了
接收 `t` 的工厂函数。上游若也重构了同一处，**保留上游的结构**，同时保留 `t()` 的使用。

### 手工同步命令

```bash
git fetch upstream --tags
git checkout i18n-zh
git merge v2.94.0            # 或 upstream/main
# 按上表逐文件解决，然后：
git add -A && git commit
git push origin i18n-zh
```

---

## 5. 补齐新文案（上游新增的英文）

上游新增文案后，先按 §4 保留英文让构建通过，再补 key：

1. 在 `src/i18n/messages/en.ts` 里找到合适的命名空间加 key（命名空间列表见文件内
   `common`、`navigation`、`table`、`peers`、`settings`、`networks`、`dns`、
   `accessControl`、`reverseProxy` 等）。
2. 在 `src/i18n/messages/zh.ts` 的**同名 key** 补中文（两文件 key 结构必须对齐）。
3. 把调用点 `<div>English</div>` 改成 `<div>{t("key")}</div>`。

### 校验

```bash
npm run test:i18n     # src/i18n/detection.test.ts 的语言检测断言
npx tsc --noEmit      # key 由 global.d.ts 的 IntlMessages 做类型检查
npm run build
npm run test:unit
```

`src/i18n/global.d.ts` 把 `en.ts` 的类型声明成全局 `IntlMessages`，
所以 **`zh.ts` 缺 key 或 key 拼错会在 `tsc` 阶段直接报错**——这是主要的目录一致性保障。

---

## 6. 本地化架构速览

```
src/i18n/
├── config.ts            # locales / defaultLocale / 目录 / cookie 名 / 时区（单一真源）
├── detection.ts         # cookie → 浏览器语言 → default 的客户端探测
├── detection.test.ts    # 探测逻辑断言
├── request.ts           # next-intl 构建期请求配置
├── global.d.ts          # IntlMessages 类型增强（key 类型检查的来源）
└── messages/
    ├── en.ts            # 英文目录（3185 行，类型基准）
    └── zh.ts            # 中文目录（3079 行）

src/contexts/LocaleProvider.tsx   # 运行时 provider：探测语言 → NextIntlClientProvider
src/components/ui/LocaleSwitcher.tsx  # 头部语言切换器
```

**静态导出的约束**：`next.config.js` 用 `output: "export"`，没有服务端运行时，
因此**不能**用 middleware 或 `[locale]` 路由段做语言路由。语言在客户端
`useEffect` 里解析（cookie → `navigator.languages` → 默认），构建期渲染 `en`，
避免 hydration 不一致。

- 默认语言：**`en`**（`src/i18n/config.ts` 的 `defaultLocale`）
- 中文入口：浏览器语言为 `zh*` 时自动命中，或用户用切换器手动选
- 切换持久化：cookie `NEXT_LOCALE`（1 年）

---

## 7. 部署到自建 NetBird

本部署在 `1.13.193.126`（单节点，Debian 13，Traefik v3.6 反代，IP 证书）。
**已完成本地化部署**：dashboard 容器现在跑
`ghcr.io/supportspark/dashboard:zh-latest`，回滚只需回到 `netbirdio/dashboard:v2.94.0`。

### 方案 A：拉构建好的镜像（推荐，已采用）

服务器上已有覆盖文件 `/opt/netbird/docker-compose.i18n.yml`：

```bash
cd /opt/netbird

# 部署 / 升级
docker compose -f docker-compose.yml -f docker-compose.i18n.yml up -d dashboard

# 回滚到官方镜像（只用主 compose 文件即可）
docker compose up -d dashboard
```

覆盖文件只改 dashboard 服务的 `image`，其余标签与网络沿用主 compose，
所以 Traefik 路由、`dashboard.env`、CSP 生成逻辑全部不变。

### 方案 B：离线传输镜像（GHCR 慢时）

服务器在国际链路上拉 GHCR 可能较慢（镜像约 140MB 压缩 / 1.1GB 未压缩）。
若拉取困难，可在能访问的网络里构建后 `docker save` 传过去：

```bash
# 在有网且快的机器上
git clone https://github.com/SupportSpark/dashboard.git && cd dashboard
git checkout i18n-zh
docker build -f docker/Dockerfile -t netbird-dashboard-zh:local .
docker save netbird-dashboard-zh:local | gzip > zh.tar.gz

# 传到服务器
scp zh.tar.gz root@1.13.193.126:/root/
ssh root@1.13.193.126 'gunzip -c /root/zh.tar.gz | docker load'
# 然后把 docker-compose.i18n.yml 里的 image 改成 netbird-dashboard-zh:local
```

### 部署后验证（实测步骤）

```bash
docker inspect netbird-dashboard --format 'image={{.Config.Image}} status={{.State.Status}} health={{.State.Health.Status}}'
curl -sSk -o /dev/null -w '%{http_code}\n' https://1.13.193.126/                    # 期望 200
curl -sSk -o /dev/null -w '%{http_code}\n' https://1.13.193.126/api/users           # 期望 401
curl -sSk -o /dev/null -w '%{http_code}\n' https://1.13.193.126/oauth2/.well-known/openid-configuration  # 期望 200
```

确认中文确实上线（扫描公开的 JS 分片里是否有中文串）：

```bash
curl -sSk https://1.13.193.126/ | grep -oE '/_next/static/chunks/[A-Za-z0-9_.-]+\.js' | while read -r c; do
  curl -sSk "https://1.13.193.126$c" | grep -q '保存\|取消\|节点' && echo "zh in $c"
done
```

### 实测注意事项

- **容器重建后 Traefik 需要几秒重新发现 router**，期间访问可能短暂 404。
  日志里表现为 `"-" "-"`（没有匹配到 router），而不是后端错误——等几秒即可。
- 镜像内的 nginx 会在启动脚本里 reload 一次以应用 CSP，日志中能看到
  `Reloaded nginx to apply updated CSP configuration`，属正常现象。
- `docker/init_react_envs.sh` 在容器启动时从环境变量生成运行时配置
  （同时支持 `$VAR` 与 `$$VAR` 两种占位符），既有 `dashboard.env` 可直接复用。
- 自定义管理端域名时，镜像内 CSP 由 `docker/init_react_envs.sh` 依据
  `NETBIRD_MGMT_API_ENDPOINT` / `AUTH_AUTHORITY` 生成；换域名只需改环境变量。
- `/opt/netbird/docker-compose.yml.bak-before-i18n` 是部署前的备份。

---

## 8. 升级流程（每次上游发版）

1. 等 `sync-upstream.yml` 定时跑完（每天 03:17 UTC），**或**手动触发
   （`Actions → sync upstream → Run workflow`，可填 `upstream_ref`，可勾 `dry_run`）。
2. 看 run 结果：
   - ✅ 绿：已自动合并 + 已通过构建 → 直接进第 4 步。
   - ⚠️ 开 issue：进第 3 步。
3. 按 §4 解决冲突、§5 补文案，push 到 `i18n-zh`，再手动触发一次 workflow 确认。
4. `build-localized.yml` 会自动出镜像（push 到 `i18n-zh` 即触发）。
5. 服务器上：
   ```bash
   cd /opt/netbird
   docker compose -f docker-compose.yml -f docker-compose.i18n.yml pull dashboard
   docker compose -f docker-compose.yml -f docker-compose.i18n.yml up -d dashboard
   ```
6. 按 §7 的验证命令确认 200 / 401 / 200 与中文串存在。

### 合并后一定要跑的检查

同步合并**跑绿不等于没问题**。实测中 `npm run build`、`tsc --noEmit` 和全部单元测试
都通过的情况下，仍然存在 **31 个 key 根本没定义**、**13 个上游 e2e data-testid 被改名**、
**两处上游功能被静默删除**。这类问题只有下面这些检查能发现：

```bash
npm run build                               # 静态导出是否成立
npm run test:unit                           # 上游单测（884 项）
npm run test:i18n                           # 语言探测断言
node tools/check-catalog-parity.mjs .       # en/zh key 是否对齐（TS 编译级，权威）
node tools/check-translation-keys.mjs       # 每个 t("key") 是否真的能解析
node tools/classify-remaining.mjs           # 还剩多少真正需要翻译的界面文案
node tools/find-hardcoded-english.mjs       # 硬编码英文清扫
node tools/find-dropped-upstream-code.mjs   # 上游代码是否被静默丢弃
node tools/check-english-fidelity.mjs       # 英文目录是否与上游原文有出入
pwsh -File tools/check-merge-integrity.ps1  # 冲突标记 / i18n 接线 / 目录来源
```

`i18n-parity.yml` 已接入目录对齐与 key 解析两项。

> ⚠️ **`tsc` 不是可信的钥匙**：next-intl 的 key **不做类型检查**，写错 key 一样编译通过，
> 只在运行时把原始 key 渲染到界面上。而且只要有任何一个文件存在**语法错误**，
> `tsc` 会**抑制全部语义错误**——此时它可能在 373 处绑定缺失的情况下报“0 错误”。
> 判断 key 是否可用只看 `check-translation-keys.mjs`。

---

## 8.5 翻译工作流（批量补译时）

大面积补译不要直接改 `src/i18n/messages/{en,zh}.ts`：多个执行者会互相覆盖。
用 fragment：

1. 每个执行者只写自己的 `i18n-fragments/<名字>.json`：
   ```json
   { "命名空间": { "keyName": { "en": "English", "zh": "中文" } } }
   ```
   每个 key **必须**同时有 en 和 zh；合并工具会校验，缺一个整份 fragment 被拒。
   两份 fragment 若对同一个 `命名空间.key` 给出不同值，合并**整体失败**（不会写半个）。
2. 由**单一写入者**执行合并：`node tools/merge-i18n-fragments.mjs`
   它是幂等的、只新增不覆盖，可以反复运行。
3. `node tools/check-merge-integrity.ps1` 的 *catalog provenance* 段会验证
   “每份 fragment 的每个 key 都已在 en.ts 里”，防止“看着没事”其实是没合进去。

**命名空间冲突**：动手前先 `Select-String -Path src/i18n/messages/en.ts -Pattern '^  名字: \{'`
确认目标命名空间是否已被占用；已被别的 fragment 声明的 key 不要重复定义。

**模块级常量**：如果英文文案在模块级 `const items = [{ label: "X" }]` 里，
**不能**在那里调用 `t()`——它是 React hook，模块作用域调用会在浏览器 import 时抛
"Invalid hook call"，而构建仍然成功、`tsc` 也不会报错。改成工厂函数：
`const items = (t) => [...]`，在组件内 `useMemo(() => items(t), [t])`。


---

## 9. 已知注意事项

- **`npm run lint` 目前是坏的**：上游改用 `eslint .`，本地化分支的部分历史提交
  仍按旧脚本调用。以 `npx tsc --noEmit` + `npm run build` 作为准入门槛。
  ⚠️ 注意 `tsc --noEmit` 在**没跑过 `next build`** 时会误报大量
  `Cannot find module '@/assets/*.svg'`——那是 `next-env.d.ts`（被 gitignore）
  还没生成导致的，不是真错误。先 `npm run build` 再 `tsc` 就干净了。
- **不要用全局 `-X ours` 合并**：会静默丢弃上游修复（见 §3.1）。
- **翻译目录必须成对更新**：只加 `en.ts` 不加 `zh.ts` 会被 `tsc` 拦下（这是 feature）。
- **`t("key")` 的命名空间必须对**：key 存在但在别的命名空间下，`tsc` 不报错、
  构建不报错、测试也不报错，只在运行时显示原始 key。用
  `tools/check-translation-keys.mjs` 兜住（本次抓到 31 处）。
- **`useTranslations()` 不写命名空间时**，只能解析点号路径（`t("navigation.peers")`）；
  写扁平 key 会 MISSING_MESSAGE。构建日志里出现 `MISSING_MESSAGE: xxx (en)`
  就说明有这种情况。
- **上游 e2e 选择器用 `data-testid`**：本分支历史提交把部分属性改名成了 `data-cy`，
  会让上游 e2e 全部失效。已修正到与上游一致（仅保留上游本来就用 `data-cy` 的 8 处）。
  改动 UI 时不要引入 `data-cy`。
- **上游单测不带 Provider**：上游组件测试直接 `render(<Component />)`，而本地化
  组件调用 `useTranslations()`。`vitest.setup.ts` 用 next-intl 自己的
  `createTranslator` 注入真实英文目录来解决，好处是**上游测试文件保持一字不改**，
  后续同步不会反复冲突。不要为了修测试去改上游测试文件。
- **`src/i18n/detection.test.ts` 是脚本不是 vitest 用例**（它调 `process.exit()`），
  必须留在 `vitest.config.mts` 的 `exclude` 里，否则 vitest 收集它会报
  "No test suite found in file"；它通过 `npm run test:i18n` 运行。
- **主题实现已换**：上游删除了 `next-themes` / `GlobalThemeProvider`，改为自研
  `src/contexts/ThemeProvider.tsx`；本地化分支已跟随上游，不要再引入 `next-themes`。
- **`docker/server.js` 方案已废弃**：上游用 nginx + `envsubst` 取代（见
  `docker/init_react_envs.sh`），且已处理 `$VAR` / `$$VAR` 两种占位符。
- **上游已删除的功能**：`firewall-gpt` 整个模块、`traffic-events` 的图表组件、
  `OnboardingDemoCall`、`.eslintrc.json`。同步后不要把它们找回来。
- **上游 e2e / storybook 门禁**：本分支未跑上游的 Playwright e2e 与视觉回归
  （需要 Docker 测试环境），CI 只做 build + 上面那些静态门禁。

---

## 10. 翻译覆盖现状

**目录规模**：en/zh 各 4413 个 key（2625 → 4413，本轮补译 +1788），结构完全对齐，
4369 个命名空间内字面量 key 全部可解析。

- **已本地化**：导航、Peers/节点详情、Access Control/策略、Groups/组、Users/用户、
  Service Users、Setup Keys、DNS（nameservers/zones/settings）、Networks/网络、
  Network Routes/路由、Posture Checks、Reverse Proxy（services/domains/clusters/logs/
  auth/targets/events 全部子模块）、Activity/活动日志（含约 105 个事件描述模板）、
  Settings 全部标签页、Notifications、Invoices、Webhooks、Onboarding（含注册表单、
  调查、Agent Network 引导）、Integrations（EDR / Event Streaming / IdP Sync / SSO）、
  Agent Network、Control Center（画布、菜单、面板、草稿模态框）、
  Cloud（MSP / Distributor / Traffic Events / Sign-in Domains / MFA）、
  Billing、Error/404、语言切换器。
- **有意保留英文**：品牌与协议名（NetBird、Cluster、Integration、SSO、SCIM、
  Okta、CrowdStrike、Datadog…）与参考数据（ICMP 类型名、OS 版本标签、
  云区域列表、国家英文值——后者是 HubSpot 表单提交所需）。用
  `node tools/classify-remaining.mjs` 可以把“真正待人翻译的文案”和“参考数据”分开统计。
- **技术债**：`untranslated` 命名空间（485 条英文占位）仍在目录里，**无任何组件引用**，
  因此对界面没有影响。删除脚本因用花括号计数、在含 `{}` 的 ICU 字符串上会算错而损坏目录，
  已被移除；要清理请用基于行范围的编辑器，不要用括号匹配。

### 本轮补译的经验（值得保留）

| 坑 | 表现 | 防御 |
| --- | --- | --- |
| key 拼错/命名空间错 | 编译、构建、测试全过，界面显示原始 key | `check-translation-keys.mjs` |
| 模块级 `t()` 调用 | 浏览器 import 时抛 Invalid hook call | 工厂函数 + 该工具的 `--area` 检查 |
| 并发写目录 | 互相覆盖、命名空间消失 | fragment + 单一写入者 + provenance 守卫 |
| 凭记忆改英文 | `You're all set!` → `You are all set!` | 上游单测（最强门禁）+ `check-english-fidelity.mjs` |
| 扫描器误报/漏报 | 漏报 95%，或把 Tailwind/rgba 当文案 | 采样人工核对，别只看数字 |

---

## 11. 参考

- 上游仓库：https://github.com/netbirdio/dashboard
- 采用的本地化 PR：https://github.com/netbirdio/dashboard/pull/671
- 另一条 i18n 路线（11 语言，覆盖较浅）：https://github.com/netbirdio/dashboard/pull/825
- next-intl 文档：https://next-intl.dev
- NetBird 自建文档：https://docs.netbird.io/selfhosted/selfhosted-quickstart
