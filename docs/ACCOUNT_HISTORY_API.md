# 新增 `/v1/account-history` 接口（cursor 分页）

## Context

老的 `/v1/history/get_actions` 给客户端用很别扭：
- `pos` / `offset` 双参数，正负号决定方向，client 必须自己算下一页
- `pos` 当作 `global_sequence` 用，但 `fibos_actions.global_sequence` 是 `text(64)`，做 `<=` 比较是字符串比较，长度变化时排序错乱
- 响应里没显式 `next_cursor` / `has_more`，全靠 client 推断字段（`account_action_seq` 还是 `global_action_seq`），上游容易出 bug
- LIB 走单独 RPC，慢且偶尔超时

新设计一个独立接口 `GET /v1/account-history/:account`，cursor 分页，server 算 `next_cursor`，client 只负责回传。

旧 `/v1/history/get_actions` 不动，保留兼容。

## 接口

```
GET /v1/account-history/:account?cursor=<int>&limit=<int>
```

参数：
- `:account` (path) — 账户名，必填，正则 `^[a-z1-5.]{1,12}$`
- `cursor` (query, optional) — 上一页响应里的 `next_cursor`；首屏不传
- `limit` (query, optional) — 1..100，默认 20

响应：

```jsonc
{
  "items": [
    {
      "action_id": 982314,                  // server PK (fibos_account_actions.action_id)，作为 cursor 用，client 不解释
      "global_sequence": "9876543",         // 仅作展示/调试
      "trx_id": "abc123...",
      "block_num": 12345678,
      "block_time": "2024-01-01T00:00:00.500",
      "act": {
        "account": "fibos.token",
        "name": "transfer",
        "authorization": [{"actor":"alice","permission":"active"}],
        "data": { "from":"alice","to":"bob","quantity":"1.0000 FO","memo":"" },
        "hex_data": "..."
      }
    }
    // newest first
  ],
  "next_cursor": 982294,        // 下一页传回；null = 到底
  "has_more": true,
  "last_irreversible_block": 87654321
}
```

## 为什么用 `action_id` 当 cursor

- `fibos_account_actions` 主键 `(account, action_id)`，`action_id` 是 `fibos_actions.id` 的自增 INTEGER —— 严格单调、本地稳定、可复用复合索引做 DESC 范围扫描。
- 不用 `global_sequence`：它是 `text(64)`，跨长度比较会错。
- cursor 是 server-internal 的不透明数值，client 只负责回传。

## SQL（后端核心）

```sql
-- 首屏（cursor 缺省）
SELECT aa.action_id, aa.receipt, a.global_sequence, a.trx_id, a.rawData
FROM fibos_account_actions aa, fibos_actions a
WHERE aa.account = ? AND aa.action_id = a.id
ORDER BY aa.action_id DESC
LIMIT ? + 1;

-- 后续页（cursor = 上一页 next_cursor）
SELECT aa.action_id, aa.receipt, a.global_sequence, a.trx_id, a.rawData
FROM fibos_account_actions aa, fibos_actions a
WHERE aa.account = ? AND aa.action_id <= ? AND aa.action_id = a.id
ORDER BY aa.action_id DESC
LIMIT ? + 1;
```

`LIMIT ? + 1` 的技巧：多取一条来判断 `has_more`，返回时再裁掉。

`next_cursor` 的算法（server 算，client 不算）：
- 若 `rows.length > limit` → `next_cursor = items[items.length-1].action_id - 1`，`has_more = true`
- 否则 → `next_cursor = null`，`has_more = false`

## 服务端字段映射

`a.rawData` 是完整 action_trace JSON。从中提取：
- `block_num`, `block_time` — 顶层字段
- `act` — 直接透传 `rawData.act`（已包含 `account / name / authorization / data / hex_data`）
- `trx_id` — `a.trx_id` 列已有
- `global_sequence` — 从 `aa.receipt` 解析后取 `global_sequence`

LIB 复用 `getLib()`（参考 `api/v2.history.js:279-286`），可拷贝一份到新文件，或抽到 `lib/` 公共。

## 改动文件

### 新建 `api/account-history.js`

文件结构参考 `api/v2.history.js:1-8` 和 `api/explorer.js`：

```js
'use strict';

const SQL = require('sql-template-strings');
const axios = require('axios');
const httpEndPoint = require('../config/explorer.json').httpEndPoints[0];

module.exports = (app, db) => {
    app.get('/v1/account-history/:account', getAccountHistoryGET);

    function getAccountHistoryGET(req, res) { ... }

    function getLib() { ... }   // 拷贝自 v2.history.js:279
};
```

`getAccountHistoryGET` 实现要点：
- 校验 `account`（非空，正则 `/^[a-z1-5.]{1,12}$/`）；不通过 → 400
- `cursor`：`Number.parseInt(req.query.cursor, 10)`；`NaN` 或负数 → 视为缺省（首屏）
- `limit`：解析整数，clamp 到 `[1, 100]`，默认 20
- 用上述两条 SQL（`sql-template-strings` 拼接，避免注入）
- 解析 `aa.receipt` 和 `a.rawData`，组装 `items`（newest-first，已是 DESC 顺序）
- `LIMIT ?+1` 多取一条判断 `has_more`，返回前 `limit` 条
- `next_cursor = has_more ? items[items.length-1].action_id - 1 : null`
- `Promise.all([getLib(), sqlPromise])` 并发拿 LIB
- 错误统一 500 + `{ error: err.message }`

swagger 注释照 `v2.history.js:10-34` 的格式补一段。

### `index.js` 注册新模块

第 43-49 行的 `sqlite.open(...).then(db => { ... })` 块里加一行：

```js
require('./api/account-history.js')(app, db);
```

## 关键文件 & 行号

- 新建：`api/account-history.js`
- 入口注册：`index.js:43-49`
- 参考实现 & `getLib`：`api/v2.history.js:128-206`、`:279-286`
- 数据 schema：`../fibos-explorer-tracker/lib/defs/fibos_account_actions.js:1-24`、`fibos_actions.js:1-63`

## 验证

1. 本地起服务：`pm2 start pm2.json` 或 `node index.js`
2. 首屏：
   ```bash
   curl 'http://localhost:8090/v1/account-history/eosio?limit=5' | jq
   ```
   断言：`items.length === 5`、`items[0].action_id > items[4].action_id`、`next_cursor === items[4].action_id - 1`、`has_more === true`
3. 翻页：
   ```bash
   curl 'http://localhost:8090/v1/account-history/eosio?limit=5&cursor=<上一页 next_cursor>' | jq
   ```
   断言：第二页第一条 `action_id <= 上一页 next_cursor`，且严格小于上一页最后一条
4. 翻到底：用极小 cursor（如 `cursor=10`）请求一个新账户，断言 `has_more === false` 且 `next_cursor === null`
5. 边界：不存在的账户 → `items: []`、`has_more: false`、`next_cursor: null`、HTTP 200
6. 非法 account（如 `Eosio` 大写）→ HTTP 400

## 不在范围

- 旧 `/v1/history/get_actions` 不动
- 不引入按 `action_name` / `contract` 过滤的参数（留作 v2）
- 不做服务端 trx 分组（边界拼接复杂；交给前端做）
- `global_sequence` 仍用 TEXT 存储不改 schema
