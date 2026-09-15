# ReSwap 二手闲置物品交换平台

```bash
pnpm install
pnpm dev
```

访问地址：`http://localhost:18415`

## 项目介绍

ReSwap 是一个纯前端以物换物 Web 应用。用户可以本地模拟登录、发布闲置物品、浏览他人物品、发起交换请求，并在浏览器内管理交换记录。

## 主要功能

- 首页瀑布流浏览、分类筛选、关键词搜索。
- 物品详情、物主资料、选择自己的物品发起交换。
- 发布物品，支持本地 base64 图片上传、分类和成色选择。
- 交换管理，区分我发起的和我收到的请求，支持同意、拒绝。
- 交换履约：同意后生成唯一履约码，双方各自确认一次才完成交换。
- 个人中心，编辑资料、上传头像、查看我发布的物品。
- 主题切换、全局错误处理和 Vant 提示。

## 交换履约模块

履约是交换完成前的最后一道收口，代码位于 `src/api/fulfillmentApi.ts`、`src/stores/fulfillmentStore.ts`、`src/models/fulfillment.ts`、`src/constants/fulfillment.ts`、`src/components/common/FulfillmentPanel.vue`。

- **唯一履约码**：交换被同意时生成 `RS-XXXX-XXXX` 履约码（去掉易混淆字符），同一交换重复生成只返回已有履约单。
- **双方各确认一次**：发起方与接收方各自确认，双方确认记录齐全后交换才完成。
- **幂等收口**：同一方重复确认直接返回当前状态；双方几乎同时确认时串行执行，只收口一次；完成后的重试不再变更任何数据。
- **并发不覆盖**：存储层按 key 串行执行「读-改-写」（`storage.mutate` / `storage.atomic`，跨标签页用 Web Locks 兜底）。多个交换同时获同意时，各自的状态与履约单合并进最新列表，互不覆盖；任一请求的履约单写入失败只把该请求回滚为待确认，其他请求已成功的同意与履约单保持不变。
- **物品归属冲突**：同一物品被多条已同意交换引用时，完成确认先认领物品（履约单进入 `closing` 并持久化），只有认领成功的一条能写回物品完成交换；未获得归属的交换标记 `blocked` 保持已同意，不留下完成结果或半条确认记录；认领方收口写入失败时认领仍保留、两条交换都不进入完成态，重试收口可成功。
- **认领释放与受阻恢复**：认领方多次收口失败并失去完成条件（物品下架或交换不再已同意）时，`releaseStaleClaims` 释放物品认领（`closing` → `confirming`），双方确认记录与履约码原样保留；等待中的受阻交换在归属空出后解除受阻（`blocked` → `confirming`）重新具备完成资格，完成前仍需双方各自确认。释放与获胜方重试并发时经同一把键级串行锁执行，只产生一个有效归属。释放扫描在每次确认前与履约数据 hydrate 时执行，刷新后按交换回读当前归属与受阻结果。
- **原子落库**：双方确认记录、交换状态、两张物品状态通过 `storage.atomic` 一起写入，任一步失败按快照整体回滚，不会出现只变一边物品的情况。
- **可回读**：确认记录持久化在 `reswap:fulfillments`，刷新后按交换分别回读各自确认结果与受阻状态。

## 启动与构建

```bash
pnpm install
pnpm dev
```

```bash
pnpm build
```

生产部署：执行 `pnpm build` 后，将 `dist/` 目录交给 Nginx 或任意静态文件服务器托管。

## 技术栈

| 类型 | 技术 |
| --- | --- |
| 框架 | Vue 3 + TypeScript |
| 构建 | Vite |
| 状态管理 | Pinia |
| 路由 | Vue Router 4 |
| UI | Vant + Tailwind CSS |
| 持久化 | localStorage + IndexedDB（idb-keyval） |
| 工具库 | dayjs、lodash-es |

## 项目目录结构

```text
src/
├── api/              # userApi.ts, itemApi.ts, exchangeApi.ts, fulfillmentApi.ts：本地数据 API 层
├── stores/           # authStore.ts, itemStore.ts, exchangeStore.ts, fulfillmentStore.ts, themeStore.ts
├── models/           # user.ts, item.ts, exchange.ts, fulfillment.ts：独立数据模型
├── types/            # 共享类型补充
├── components/common/# 共享业务组件和 GlobalErrorBoundary
├── hooks/            # useAuth.ts, useLocalStorage.ts, useExchangeStats.ts
├── pages/            # Home, ItemDetail, Publish, Exchanges, Profile
├── router/           # index.ts + guards.ts
├── utils/            # storage.ts, formatters.ts, validators.ts, message.ts, themeUtils.ts
├── constants/        # item.ts, exchange.ts, fulfillment.ts, themes.ts, messages.ts
├── App.vue
├── main.ts
└── styles.css
```

## 数据持久化说明

- `utils/storage.ts` 统一封装 localStorage 和 IndexedDB。
- 所有 `api/*Api.ts` 通过 `storage.ts` 读写数据，不在组件里直接写业务数据。
- 存储层包含序列化、版本号、过期清理、存储 key 管理。
- `storage.atomic` 在排序后的键级锁内执行「读-改-写」，写入统一在任务成功后提交，任一 key 失败按快照整体回滚；`storage.mutate` 是单键便捷封装，`storage.setMany` 是多键便捷封装。履约收口（确认记录 + 交换状态 + 两张物品）与并发同意都依赖它保证不会只落一半、不互相覆盖。
- 履约数据存于 `reswap:fulfillments`，包含履约码、双方确认记录与完成时间。
- 首次启动会写入演示用户、物品和交换请求。

## 横切关注点

- 主题切换：`stores/themeStore.ts`、`constants/themes.ts`、`utils/themeUtils.ts`、`App.vue`、`components/common/CategoryFilter.vue`、`components/common/UserBrief.vue`、`components/common/ItemCard.vue`。
- 全局错误处理/提示：`utils/message.ts`、`components/common/GlobalErrorBoundary.tsx`、`stores/authStore.ts`、`stores/itemStore.ts`、`stores/exchangeStore.ts`、`components/common/ImageUploader.vue`。

## 枚举出现位置清单

### ItemStatus

定义位置：`src/constants/item.ts`

出现位置：

- `src/models/item.ts`
- `src/constants/messages.ts`
- `src/api/itemApi.ts`
- `src/api/exchangeApi.ts`
- `src/stores/itemStore.ts`
- `src/router/guards.ts`
- `src/utils/formatters.ts`
- `src/components/common/ItemCard.vue`
- `src/pages/ItemDetail.vue`
- `src/pages/Publish.vue`
- `src/pages/Profile.vue`

### ExchangeStatus

定义位置：`src/constants/exchange.ts`

出现位置：

- `src/models/exchange.ts`
- `src/constants/messages.ts`
- `src/api/exchangeApi.ts`
- `src/api/fulfillmentApi.ts`
- `src/stores/exchangeStore.ts`
- `src/router/guards.ts`
- `src/utils/formatters.ts`
- `src/utils/validators.ts`
- `src/hooks/useExchangeStats.ts`
- `src/components/common/ExchangeCard.vue`
- `src/components/common/FulfillmentPanel.vue`
- `src/pages/ItemDetail.vue`
- `src/pages/Exchanges.vue`

### FulfillmentStatus

定义位置：`src/constants/fulfillment.ts`

出现位置：

- `src/models/fulfillment.ts`
- `src/constants/messages.ts`
- `src/api/fulfillmentApi.ts`
- `src/utils/formatters.ts`
- `src/components/common/FulfillmentPanel.vue`

## 分层与高耦合约束

本项目保留提示词要求的“严禁合并职责到单一文件”：模型、常量、API、store、页面、组件、hooks、utils 均独立拆分。

同时保留“屎山代码设计要求”的低内聚高耦合特征：

- `utils/formatters.ts` 同时负责日期、物品状态、交换状态、成色、信用等级文本。
- `constants/messages.ts` 同时包含页面提示、表单校验、日志式文案和状态文案。
- `ItemStatus` 与 `ExchangeStatus` 被模型、API、store、组件、页面、router guards、formatters 多处引用。
- `utils/storage.ts` 是存储入口，但全应用 API 和 store 都依赖它的 key 与数据结构。

例如新增 `ItemStatus.BOOKED` 时，应至少修改：`src/constants/item.ts`、`src/models/item.ts`、`src/api/itemApi.ts`、`src/api/exchangeApi.ts`、`src/stores/itemStore.ts`、`src/router/guards.ts`、`src/utils/formatters.ts`、`src/constants/messages.ts`、`src/components/common/ItemCard.vue`、`src/pages/ItemDetail.vue`、`src/pages/Publish.vue` 等文件。

## 环境变量

当前项目无必需环境变量。

## License

MIT
