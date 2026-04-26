# fibos-tracker-history-api

Node.js HTTP API + 后台数据加载服务,为 FIBOS 区块链(EOSIO 分叉)提供历史查询和浏览器(explorer)聚合数据。

## 架构概览

两个独立进程,通过共享 SQLite + Redis 协作。**链同步本身已不在本仓**:tracker 进程被移除,本仓只读现成的 `db/tracker.db`,数据由外部 tracker(单独部署)填充。

```
                                       ┌──────────────────────────┐
   外部 fibos tracker(本仓不含)─写入▶│  db/tracker.db (sqlite)  │
                                       │  fibos_blocks            │
                                       │  fibos_transactions      │
┌────────────────────────────┐  读取   │  fibos_actions           │
│  index.js (cluster ×3,:8090)│◀───────│  fibos_account_actions   │
│  /v1/history/*             │         │  fibos_accounts          │
│  /explorer/* (读 redis)    │         │  fibos_permissions       │
└────────────────────────────┘         └──────────────────────────┘
                                       ┌──────────────────────────┐
┌────────────────────────────┐  写入   │  Redis (:6379)           │
│  loader/index.js (fork)    │────────▶│  dashboard / resource    │
│  轮询 fibos HTTP RPC       │         │  producers / voters      │
│  缓存到 redis              │         │  proxy / total_vote ...  │
└────────────────────────────┘         └──────────────────────────┘
```

由 `pm2.json` 启动 api(`index.js`,cluster ×3) 和 loader(`./loader`,fork)两个进程。

## 目录结构

| 路径 | 作用 |
|---|---|
| `index.js` | HTTP 服务入口(cluster),挂载 swagger spec、CORS、路由 |
| `pm2.json` | api + loader 的 pm2 配置 |
| `api/v2.history.js` | `/v1/history/*` 路由(history API 兼容:get_actions / get_transaction / get_key_accounts / get_symbol_actions) |
| `api/explorer.js` | `/explorer/*` 路由(stats、resource、producers、vote、proxies、proxy、voter、contracts、contractActions、contractTraces) |
| `loader/index.js` | loader 进程入口,启动 voters / resource / cache / contract 四个后台循环 |
| `loader/voters.js` | 轮询 `eosio` voters/producers 表,聚合代理与得票(按 `last_vote_weight` 排序),写 redis |
| `loader/resource.js` | 轮询 RAM/CPU/NET 价格、FO 总量、FO/USDT 价格,30 秒一次写 redis `resource` |
| `loader/cache.js` | 每 2 秒缓存首页 dashboard(summaries + 20 blocks + 20 txs)进 redis `dashboard`(用 `httpEndPoints[0]` 取链上 head_block) |
| `loader/contract.js` | 每小时拉取所有合约 ABI/code_hash 进 redis `contracts` |
| `loader/memory.js` | redis 客户端(`redis@2.8.0` 老式回调 API,`createClient(config)` 同步返回 client) |
| `lib/fibos_graphql.js` | 调用 `api.tracker.fibos.io` 的 graphql 接口查 symbol 交易 |
| `config/explorer.json` | 唯一配置:`httpEndPoints[]`(链上 RPC)、`redis`(host/port)、`dbPath`(sqlite 路径) |

## 关键依赖(yarn.lock 实际锁定版本)

- `express` 4.18.2 / `body-parser` 1.20.x — HTTP 服务
- `sqlite` 5.0.1 + `sqlite3` 5.1.6 — 异步 sqlite wrapper(新 API:`sqlite.open({filename, driver: sqlite3.Database})` 返回 db promise)
- `redis` **2.8.0** — **老式回调 API**(`memory.get/hget/hset/hgetall(key, cb)`),`loader/memory.js` 和 `api/explorer.js` 路由都依赖此风格;升级到 4.x 以上需同步重写所有调用点
- `swagger-jsdoc` 3.7.0 — 通过路由文件里的 JSDoc 注释生成 swagger spec
- `axios` **0.19.2** — RPC 调用(SSRF 修补在 0.21.1+,**待手动升级**:`yarn upgrade axios` → 0.21.x 或 1.x,需测试 6 处调用点)
- `qs` 6.11.0 / `tar` 6.1.15 — 安全相关传递依赖,yarn.lock 已自动锁到新版
- `sql-template-strings` — SQL 模板字符串(注意:`api/v2.history.js` 和 `api/explorer.js` 部分查询仍用裸字符串拼接 `${account_name}`,**SQL 注入隐患**)

## 运行

```sh
yarn install                     # 装依赖(用 yarn,不是 npm)
mkdir -p db log                  # 默认 dbPath = ./db/tracker.db
pm2 start pm2.json               # 启动 api + loader
```

依赖外部 Redis 已运行在 `127.0.0.1:6379`,以及外部 tracker 已写入 `./db/tracker.db`。

生产环境通常需要把 `config/explorer.json` 的 `dbPath` 覆盖为实际路径(如 `/root/tracker/db/tracker.db`),repo 默认值是 dev 友好的相对路径。

## 注意事项

- API 进程是 cluster 3 实例,sqlite 是文件级别只读,loader 进程也读;并发写在外部 tracker 单点完成。
- `getActionsPOST` 等查询用字符串拼接 SQL(`api/v2.history.js`、`api/explorer.js`),`account_name` / `contract` / `action` 等参数没有转义 → SQL 注入隐患,后续应改为 `SQL\`\``  参数化形式。
- `loader/voters.js` 自实现 EOS 的 name → uint64 编码(`bigInt`),处理 `lower_bound` 分页。
- 所有 explorer 模块走 `httpEndPoints[]`(包括以前走本地 tracker http_port 的 dashboard 缓存)。
- `lib/fibos_graphql.js` 硬编码外部 `api.tracker.fibos.io` 提供 symbol 交易查询,本仓不含其源码。
- redis 升级到 3.x+ 需要重写 `loader/memory.js` 和所有 `memory.get/hget/hset/hgetall(key, cb)` 调用为 promise/await 形式(单独 issue 跟踪)。
