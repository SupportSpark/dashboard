# 中文本地化仪表盘：安装与使用

本仓库是 [netbirdio/dashboard](https://github.com/netbirdio/dashboard) 的 fork，在
`i18n-zh` 分支上增加完整的简体中文界面（英文原版完整保留，可随时切换）。

给**使用者**的说明在本文；给**维护者**的同步流程见 [I18N-SYNC.md](./I18N-SYNC.md)。

---

## 一、最快的方式：直接用已构建的镜像

镜像已发布到公开的 GHCR，**不需要 GitHub 账号**，匿名即可拉取：

```
ghcr.io/supportspark/dashboard:zh-latest
```

- 支持 **amd64 与 arm64**（x86 服务器和 ARM / 树莓派都可以）
- 大小约 **141 MB**
- 每次构建都带 `org.opencontainers.image.revision` 标签，可对到具体提交

### 前置条件

已经有一个能跑的 **自建 NetBird**（官方 quickstart 装好的即可）。目录通常是
`/opt/netbird`，其中已有 `docker-compose.yml` 和 `dashboard.env`。

### 步骤

**1. 下载覆盖文件**（它只覆盖 `dashboard` 一个服务，traefik / netbird-server 都不动）

```bash
cd /opt/netbird
curl -fsSLO https://raw.githubusercontent.com/SupportSpark/dashboard/i18n-zh/docker-compose.i18n.yml
```

**2. 拉起中文仪表盘**

```bash
docker compose -f docker-compose.yml -f docker-compose.i18n.yml up -d dashboard
```

**3. 打开你的管理地址**，右上角地球图标里选「中文」。

不需要改任何配置：`dashboard.env` 里的 `NETBIRD_MGMT_API_ENDPOINT`、
`AUTH_AUTHORITY` 等已经指向你自己的服务端，覆盖文件会沿用它们。

### 回滚到官方英文版

```bash
docker compose up -d dashboard     # 只用主 compose 文件即可
```

### 升级到新版本

```bash
cd /opt/netbird
docker compose -f docker-compose.yml -f docker-compose.i18n.yml pull dashboard
docker compose -f docker-compose.yml -f docker-compose.i18n.yml up -d dashboard
```

---

## 二、网络拉取慢（中国大陆常见）

GHCR 在国内链路较慢，首次拉取可能很久。有两个办法：

**办法 A：分次重试。** Docker 支持断点续传，多次执行同一条 `docker pull` 会接着下载：

```bash
for i in 1 2 3 4 5; do docker pull ghcr.io/supportspark/dashboard:zh-latest && break; sleep 5; done
```

**办法 B：在能访问的机器上构建好，再传输过去**（推荐，一次搞定）

```bash
# 在能访问 GitHub 的机器上
git clone https://github.com/SupportSpark/dashboard.git
cd dashboard && git checkout i18n-zh
docker build -f docker/Dockerfile -t netbird-dashboard-zh:local .
docker save netbird-dashboard-zh:local | gzip > zh.tar.gz

# 传到目标服务器并导入
scp zh.tar.gz root@你的服务器:/root/
ssh root@你的服务器 'gunzip -c /root/zh.tar.gz | docker load'
```

然后把覆盖文件里的 `image:` 一行改成：

```yaml
image: netbird-dashboard-zh:local
```

**办法 C：完全离线构建。** 构建本身需要 Node 24 + npm 依赖（约 700 个包），
所以首次构建仍需网络；构建完成后镜像可离线传输。

---

## 三、自己维护一份（想改翻译或跟进上游）

```bash
git clone https://github.com/SupportSpark/dashboard.git
cd dashboard
git checkout i18n-zh
npm ci
npm run build        # 产出 out/，被 docker/Dockerfile 打进镜像
```

### 分支说明

| 分支 | 用途 |
| --- | --- |
| `main` | **上游纯净镜像**，只做 fast-forward，不要在这里开发 |
| `i18n-zh` | 本地化分支（默认分支），所有中文改动都在这里 |

### 改翻译

文案在 `src/i18n/messages/en.ts` 与 `zh.ts`。**两个文件必须成对新增**：
`en.ts` 决定 TypeScript 类型，只加 `zh.ts` 会编译失败；只加 `en.ts` 则界面会显示
原始 key。改完跑：

```bash
node tools/check-catalog-parity.mjs .    # en/zh 结构是否对齐
node tools/check-translation-keys.mjs    # 每个 t("key") 能否解析
npm run build                            # 能否静态导出
```

术语以 [I18N-GLOSSARY.md](./I18N-GLOSSARY.md) 为准（Peer=节点、Group=组、
Cluster=集群、Setup Key=安装密钥…）。

### 自动跟进上游

`.github/workflows/sync-upstream.yml` 每天 03:17 UTC 自动把上游**最新 release**
合并进 `i18n-zh`：翻译目录冲突保留中文，其他文件冲突会中止并开 issue 等你处理；
合并后必须通过构建和类型检查才会推送。

推送后 `build-localized.yml` 会自动重建并推送镜像。

**注意**：服务器**不会**自动更新。上游发版后仍需手动执行一次
`docker compose ... up -d dashboard`。

---

## 四、已知限制

以下页面**不是**本仪表盘的一部分，因此不随本镜像翻译（它们由 netbird-server
服务端渲染，文案编译在其二进制内）：

- 登录页（`/oauth2/auth/local/login`）
- 退出登录页（`/oauth2/logout`）

这两页由 `netbirdio/netbird-server` 提供，与 dashboard 是不同容器。见
[LICENSE-GATE-MAP.md](./LICENSE-GATE-MAP.md) 中的排查记录。

另：部分功能（EDR/MDM 集成、SCIM、流量事件、事件流）需要 NetBird 商业许可，
与语言无关——社区版服务端本身没有这些端点。见
[COMMUNITY-VS-COMMERCIAL.md](./COMMUNITY-VS-COMMERCIAL.md)。
