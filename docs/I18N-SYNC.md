# i18n 中文本地化分支 — 维护与上游同步手册

本仓库是 [`netbirdio/dashboard`](https://github.com/netbirdio/dashboard) 的 fork，
在官方代码之上叠加了一层 **next-intl 中英双语本地化**，主要为简体中文服务。

- **fork**：https://github.com/SupportSpark/dashboard
- **本地化分支**：`i18n-zh`
- **上游**：`netbirdio/dashboard`（默认分支 `main`）
- **本地化基线**：上游 `v2.90.7` + [`PR #671`](https://github.com/netbirdio/dashboard/pull/671)（作者 `sakuradairong`）的完整实现
- **许可证**：AGPL-3.0（与上游一致；对外提供网络服务时须遵守 AGPL 的源码提供义务）

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

本部署在 `1.13.193.126`，dashboard 目前跑 `netbirdio/dashboard:v2.94.0`。

### 方案 A：拉构建好的镜像（推荐）

```yaml
# docker-compose.yml
netbird-dashboard:
  image: ghcr.io/supportspark/dashboard:zh-latest
  # 其余环境变量沿用 dashboard.env，无需改动
```

```bash
cd /opt/netbird
docker compose pull netbird-dashboard
docker compose up -d netbird-dashboard
```

### 方案 B：本地构建

```bash
git clone https://github.com/SupportSpark/dashboard.git
cd dashboard
git checkout i18n-zh
docker build -f docker/Dockerfile -t netbird-dashboard-zh:local .
```

`docker/init_react_envs.sh` 会在容器启动时从环境变量生成运行时配置
（同时支持 `$VAR` 与 `$$VAR` 两种占位符），所以既有的 `dashboard.env` 可直接复用。

> 若自定义了管理端域名，注意镜像内的 CSP 由 `docker/init_react_envs.sh` 依据
> `NETBIRD_MGMT_API_ENDPOINT` / `AUTH_AUTHORITY` 生成；换域名只需改环境变量。

---

## 8. 升级流程（每次上游发版）

1. 等 `sync-upstream.yml` 定时跑完，**或**手动触发
   （`Actions → sync upstream → Run workflow`，可填 `upstream_ref`，可勾 `dry_run`）。
2. 看 run 结果：
   - ✅ 绿：已自动合并 + 已通过构建 → 直接进第 4 步。
   - ⚠️ 开 issue：进第 3 步。
3. 按 §4 解决冲突、§5 补文案，push 到 `i18n-zh`，再手动触发一次 workflow 确认。
4. `build-localized.yml` 会自动出镜像。
5. 服务器上 `docker compose pull && docker compose up -d`。
6. 打开面板确认中文渲染正常、语言切换可用、没有漏译的占位符。

---

## 9. 已知注意事项

- **`npm run lint` 目前是坏的**：上游改用 `eslint .`，本地化分支的部分历史提交
  仍按旧脚本调用。以 `npx tsc --noEmit` + `npm run build` 作为准入门槛。
- **不要用全局 `-X ours` 合并**：会静默丢弃上游修复（见 §3.1）。
- **翻译目录必须成对更新**：只加 `en.ts` 不加 `zh.ts` 会被 `tsc` 拦下（这是 feature）。
- **主题实现已换**：上游删除了 `next-themes` / `GlobalThemeProvider`，改为自研
  `src/contexts/ThemeProvider.tsx`；本地化分支已跟随上游，不要再引入 `next-themes`。
- **`docker/server.js` 方案已废弃**：上游用 nginx + `envsubst` 取代（见
  `docker/init_react_envs.sh`），且已处理 `$VAR` / `$$VAR` 两种占位符。
- **上游 e2e / storybook 门禁**：本分支未跑上游的 Playwright e2e 与视觉回归
  （需要 Docker 测试环境），CI 只做 build + tsc 门槛。

---

## 10. 参考

- 上游仓库：https://github.com/netbirdio/dashboard
- 采用的本地化 PR：https://github.com/netbirdio/dashboard/pull/671
- 另一条 i18n 路线（11 语言，覆盖较浅）：https://github.com/netbirdio/dashboard/pull/825
- next-intl 文档：https://next-intl.dev
- NetBird 自建文档：https://docs.netbird.io/selfhosted/selfhosted-quickstart
