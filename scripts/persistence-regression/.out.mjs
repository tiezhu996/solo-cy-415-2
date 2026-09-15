// src/constants/exchange.ts
var EXCHANGE_ACTION_FLOW = {
  ["pending" /* PENDING */]: ["accepted" /* ACCEPTED */, "rejected" /* REJECTED */],
  ["accepted" /* ACCEPTED */]: ["completed" /* COMPLETED */],
  ["rejected" /* REJECTED */]: [],
  ["completed" /* COMPLETED */]: []
};

// src/constants/fulfillment.ts
var FULFILLMENT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
var FULFILLMENT_CODE_PREFIX = "RS";

// src/constants/messages.ts
var FULFILLMENT_MESSAGES = {
  codeLabel: "\u5C65\u7EA6\u7801",
  confirmSuccess: "\u5DF2\u786E\u8BA4\u5C65\u7EA6\uFF0C\u7B49\u5F85\u5BF9\u65B9\u786E\u8BA4",
  confirmDuplicate: "\u4F60\u5DF2\u786E\u8BA4\u8FC7\u672C\u6B21\u5C65\u7EA6\uFF0C\u65E0\u9700\u91CD\u590D\u64CD\u4F5C",
  completed: "\u53CC\u65B9\u786E\u8BA4\u5B8C\u6210\uFF0C\u7269\u54C1\u72B6\u6001\u5DF2\u66F4\u65B0",
  waitingOther: "\u5DF2\u786E\u8BA4\uFF0C\u7B49\u5F85\u5BF9\u65B9\u786E\u8BA4",
  notParty: "\u53EA\u6709\u4EA4\u6362\u53CC\u65B9\u53EF\u4EE5\u786E\u8BA4\u5C65\u7EA6",
  notReady: "\u4EA4\u6362\u5F53\u524D\u4E0D\u5728\u5C65\u7EA6\u786E\u8BA4\u9636\u6BB5",
  exchangeMissing: "\u4EA4\u6362\u8BF7\u6C42\u4E0D\u5B58\u5728",
  fulfillmentMissing: "\u5C65\u7EA6\u8BB0\u5F55\u4E0D\u5B58\u5728",
  itemMissing: "\u5173\u8054\u7269\u54C1\u4E0D\u5B58\u5728\uFF0C\u65E0\u6CD5\u5B8C\u6210\u5C65\u7EA6",
  directCompleteForbidden: "\u4EA4\u6362\u5B8C\u6210\u9700\u53CC\u65B9\u5728\u5C65\u7EA6\u6A21\u5757\u4E2D\u5404\u81EA\u786E\u8BA4",
  itemConflict: "\u7269\u54C1\u5DF2\u88AB\u5176\u4ED6\u4EA4\u6362\u5360\u7528\u6216\u5DF2\u4E0B\u67B6\uFF0C\u672C\u6B21\u5C65\u7EA6\u65E0\u6CD5\u5B8C\u6210",
  blocked: "\u5C65\u7EA6\u53D7\u963B\uFF1A\u7269\u54C1\u5DF2\u88AB\u5176\u4ED6\u4EA4\u6362\u5360\u7528",
  retryClose: "\u91CD\u8BD5\u5B8C\u6210\u5C65\u7EA6",
  closing: "\u5C65\u7EA6\u6536\u53E3\u6267\u884C\u4E2D"
};
var LOG_MESSAGES = {
  storageHydrated: "storage hydrated with status maps",
  storageRollbackFailed: "storage rollback failed after partial write",
  itemStatusUsed: `ItemStatus includes ${"available" /* AVAILABLE */}, ${"exchanged" /* EXCHANGED */}, ${"offline" /* OFFLINE */}`,
  exchangeStatusUsed: `ExchangeStatus includes ${"pending" /* PENDING */}, ${"accepted" /* ACCEPTED */}, ${"rejected" /* REJECTED */}, ${"completed" /* COMPLETED */}`,
  fulfillmentStatusUsed: `FulfillmentStatus includes ${"confirming" /* CONFIRMING */}, ${"closing" /* CLOSING */}, ${"blocked" /* BLOCKED */}, ${"completed" /* COMPLETED */}`
};
var STATUS_MESSAGE_MAP = {
  ["available" /* AVAILABLE */]: "\u8FD9\u4EF6\u7269\u54C1\u53EF\u53D1\u8D77\u4EA4\u6362",
  ["exchanged" /* EXCHANGED */]: "\u8FD9\u4EF6\u7269\u54C1\u5DF2\u5B8C\u6210\u4EA4\u6362",
  ["offline" /* OFFLINE */]: "\u8FD9\u4EF6\u7269\u54C1\u5DF2\u4E0B\u67B6",
  ["pending" /* PENDING */]: "\u7B49\u5F85\u5BF9\u65B9\u786E\u8BA4",
  ["accepted" /* ACCEPTED */]: "\u4EA4\u6362\u5DF2\u540C\u610F\uFF0C\u53EF\u786E\u8BA4\u5B8C\u6210",
  ["rejected" /* REJECTED */]: "\u4EA4\u6362\u8BF7\u6C42\u5DF2\u62D2\u7EDD",
  ["completed" /* COMPLETED */]: "\u4EA4\u6362\u6D41\u7A0B\u5DF2\u5B8C\u6210"
};

// scripts/persistence-regression/mock-idb.mjs
var __failOnceFor = { key: null };
var store = /* @__PURE__ */ new Map();
var __dump = () => Object.fromEntries(store.entries());
var get = async (key) => store.get(key);
var set = async (key, val) => {
  if (__failOnceFor.key === key) {
    __failOnceFor.key = null;
    throw new Error(`injected idb failure for ${key}`);
  }
  store.set(key, val);
};
var del = async (key) => {
  store.delete(key);
};

// src/utils/storage.ts
var STORAGE_VERSION = 1;
var DEFAULT_TTL = 1e3 * 60 * 60 * 24 * 365;
var prefixed = (key) => `reswap:${key}`;
var STORAGE_KEYS = {
  currentUserId: prefixed("current-user-id"),
  users: prefixed("users"),
  items: prefixed("items"),
  exchanges: prefixed("exchanges"),
  fulfillments: prefixed("fulfillments"),
  theme: prefixed("theme"),
  lastClean: prefixed("last-clean")
};
var now = () => Date.now();
var envelope = (payload, ttl = DEFAULT_TTL) => ({
  version: STORAGE_VERSION,
  expiresAt: now() + ttl,
  payload
});
var toPlain = (payload) => JSON.parse(JSON.stringify(payload));
var isExpired = (data) => {
  if (!data) return false;
  return Boolean(data.expiresAt && data.expiresAt < now());
};
var parseLocal = (key) => {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(key);
    return null;
  }
};
var writeLocal = (key, payload, ttl) => {
  localStorage.setItem(key, JSON.stringify(envelope(payload, ttl)));
};
var keyChains = /* @__PURE__ */ new Map();
var runKeyExclusive = (key, task) => {
  const previous = keyChains.get(key) ?? Promise.resolve();
  const run = previous.then(async () => {
    if (typeof navigator !== "undefined" && navigator.locks) {
      return await navigator.locks.request(`reswap:storage:${key}`, () => task());
    }
    return task();
  });
  const tracked = run.then(
    () => void 0,
    () => void 0
  );
  keyChains.set(key, tracked);
  const cleanup = () => {
    if (keyChains.get(key) === tracked) keyChains.delete(key);
  };
  tracked.then(cleanup, cleanup);
  return run;
};
var withKeysLocked = (keys, task) => {
  const sorted = [...new Set(keys)].sort();
  const acquire = (index) => {
    if (index >= sorted.length) return task();
    return runKeyExclusive(sorted[index], () => acquire(index + 1));
  };
  return acquire(0);
};
var commitWrites = async (entries) => {
  if (!entries.length) return;
  const snapshots = await Promise.all(
    entries.map(async (entry) => ({
      key: entry.key,
      previous: await storage.get(entry.key, null)
    }))
  );
  const written = [];
  try {
    for (const entry of entries) {
      written.push(entry.key);
      await storage.set(entry.key, entry.payload);
    }
  } catch (error) {
    for (const key of [...written].reverse()) {
      const snapshot = snapshots.find((item) => item.key === key);
      try {
        if (snapshot?.previous === null || snapshot?.previous === void 0) {
          await storage.remove(key);
        } else {
          await storage.set(key, snapshot.previous);
        }
      } catch (rollbackError) {
        console.error(LOG_MESSAGES.storageRollbackFailed, rollbackError);
      }
    }
    throw error;
  }
};
var storage = {
  async get(key, fallback) {
    const localEnvelope = parseLocal(key);
    if (isExpired(localEnvelope)) {
      await this.remove(key);
      return fallback;
    }
    if (localEnvelope?.version === STORAGE_VERSION) {
      return localEnvelope.payload;
    }
    const indexedEnvelope = await get(key);
    if (isExpired(indexedEnvelope ?? null)) {
      await this.remove(key);
      return fallback;
    }
    if (indexedEnvelope?.version === STORAGE_VERSION) {
      writeLocal(key, indexedEnvelope.payload);
      return indexedEnvelope.payload;
    }
    return fallback;
  },
  async set(key, payload, ttl) {
    const plainPayload = toPlain(payload);
    const packed = envelope(plainPayload, ttl);
    localStorage.setItem(key, JSON.stringify(packed));
    await set(key, packed);
    return plainPayload;
  },
  /**
   * 事务式读写：在排序后的键级锁内执行 task，task 通过 tx.get/tx.set 读写声明过的 key；
   * task 成功后所有写入一次性提交，任一写入失败按快照整体回滚，task 抛错则不写任何 key。
   */
  async atomic(keys, task) {
    const declared = new Set(keys);
    return withKeysLocked(keys, async () => {
      const writes = [];
      const tx = {
        get: (key, fallback) => {
          if (!declared.has(key)) throw new Error(`storage.atomic \u8BFB\u53D6\u672A\u58F0\u660E\u7684 key\uFF1A${key}`);
          return storage.get(key, fallback);
        },
        set: (key, payload) => {
          if (!declared.has(key)) throw new Error(`storage.atomic \u5199\u5165\u672A\u58F0\u660E\u7684 key\uFF1A${key}`);
          writes.push({ key, payload });
        }
      };
      const result = await task(tx);
      await commitWrites(writes);
      return result;
    });
  },
  /** 单键「读-改-写」：锁内读最新值 → updater 计算 → 写回；updater 抛错则不产生任何写入 */
  async mutate(key, fallback, updater) {
    return this.atomic([key], async (tx) => {
      const current = await tx.get(key, fallback);
      const next = await updater(current);
      if (next !== current) tx.set(key, next);
      return next;
    });
  },
  /** 多键原子写入：任一 key 失败时按快照回滚已写入的 key */
  async setMany(entries) {
    await this.atomic(entries.map((entry) => entry.key), async (tx) => {
      for (const entry of entries) {
        tx.set(entry.key, entry.payload);
      }
    });
  },
  async remove(key) {
    localStorage.removeItem(key);
    await del(key);
  },
  async cleanExpired() {
    const keys = Object.values(STORAGE_KEYS);
    await Promise.all(
      keys.map(async (key) => {
        const localEnvelope = parseLocal(key);
        if (isExpired(localEnvelope)) {
          await this.remove(key);
        }
      })
    );
    localStorage.setItem(STORAGE_KEYS.lastClean, JSON.stringify(envelope((/* @__PURE__ */ new Date()).toISOString())));
  },
  createId(prefix) {
    return `${prefix}_${crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
  }
};

// src/utils/validators.ts
var validateFulfillmentConfirm = (exchange, userId) => {
  if (exchange.status !== "accepted" /* ACCEPTED */) return FULFILLMENT_MESSAGES.notReady;
  if (userId !== exchange.from_user_id && userId !== exchange.to_user_id) {
    return FULFILLMENT_MESSAGES.notParty;
  }
  return "";
};

// src/api/fulfillmentApi.ts
var FULFILLMENT_TX_KEYS = [STORAGE_KEYS.fulfillments, STORAGE_KEYS.exchanges, STORAGE_KEYS.items];
var randomCodeSegment = (length) => {
  const values = new Uint32Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(values);
  } else {
    for (let index = 0; index < length; index += 1) {
      values[index] = Math.floor(Math.random() * 2 ** 32);
    }
  }
  return Array.from(
    values,
    (value) => FULFILLMENT_CODE_ALPHABET[value % FULFILLMENT_CODE_ALPHABET.length]
  ).join("");
};
var generateFulfillmentCode = (takenCodes) => {
  let code = "";
  do {
    code = `${FULFILLMENT_CODE_PREFIX}-${randomCodeSegment(4)}-${randomCodeSegment(4)}`;
  } while (takenCodes.has(code));
  return code;
};
var buildFulfillment = (exchange, existing) => {
  const now3 = (/* @__PURE__ */ new Date()).toISOString();
  return {
    id: storage.createId("fulfillment"),
    exchange_id: exchange.id,
    code: generateFulfillmentCode(new Set(existing.map((item) => item.code))),
    status: "confirming" /* CONFIRMING */,
    confirmations: [],
    created_at: now3,
    updated_at: now3,
    completed_at: null,
    blocked_at: null
  };
};
var upsertFulfillment = (list, next) => {
  const index = list.findIndex((item) => item.id === next.id);
  if (index === -1) return [next, ...list];
  return list.map((item) => item.id === next.id ? next : item);
};
var findItemConflict = (exchange, fulfillments, exchanges, items, ownFulfillmentId) => {
  const myItemIds = [exchange.from_item_id, exchange.to_item_id];
  const myItems = myItemIds.map((id) => items.find((item) => item.id === id));
  if (myItems.some((item) => item === void 0)) return "missing";
  if (myItems.some((item) => item && item.status !== "available" /* AVAILABLE */)) return "conflict";
  const claimedByOther = fulfillments.some((fulfillment) => {
    if (fulfillment.id === ownFulfillmentId) return false;
    if (fulfillment.status !== "closing" /* CLOSING */ && fulfillment.status !== "completed" /* COMPLETED */) {
      return false;
    }
    const claimExchange = exchanges.find((item) => item.id === fulfillment.exchange_id);
    if (!claimExchange) return false;
    return [claimExchange.from_item_id, claimExchange.to_item_id].some(
      (id) => myItemIds.includes(id)
    );
  });
  return claimedByOther ? "conflict" : "";
};
var hasLostCompletionCondition = (exchange, items) => {
  if (!exchange || exchange.status !== "accepted" /* ACCEPTED */) return true;
  return [exchange.from_item_id, exchange.to_item_id].some((id) => {
    const item = items.find((entry) => entry.id === id);
    return !item || item.status !== "available" /* AVAILABLE */;
  });
};
var fulfillmentApi = {
  async list() {
    return storage.get(STORAGE_KEYS.fulfillments, []);
  },
  async getByExchange(exchangeId) {
    const fulfillments = await this.list();
    return fulfillments.find((item) => item.exchange_id === exchangeId);
  },
  /** 交换被同意后生成唯一履约码；同一交换重复调用只返回已有履约单 */
  async ensureForExchange(exchange) {
    let ensured;
    await storage.mutate(STORAGE_KEYS.fulfillments, [], (fulfillments) => {
      const existing = fulfillments.find((item) => item.exchange_id === exchange.id);
      if (existing) {
        ensured = existing;
        return fulfillments;
      }
      const fulfillment = buildFulfillment(exchange, fulfillments);
      ensured = fulfillment;
      return [fulfillment, ...fulfillments];
    });
    if (!ensured) throw new Error(FULFILLMENT_MESSAGES.fulfillmentMissing);
    return ensured;
  },
  /**
   * 释放已失去完成条件的认领（closing → confirming），归属空出后解除等待方的受阻
   * （blocked → confirming）。双方确认记录与履约码都原样保留。
   */
  async releaseStaleClaims() {
    return storage.atomic(FULFILLMENT_TX_KEYS, async (tx) => {
      const [fulfillments, exchanges, items] = await Promise.all([
        tx.get(STORAGE_KEYS.fulfillments, []),
        tx.get(STORAGE_KEYS.exchanges, []),
        tx.get(STORAGE_KEYS.items, [])
      ]);
      const now3 = (/* @__PURE__ */ new Date()).toISOString();
      let next = fulfillments;
      const released = [];
      const unblocked = [];
      for (const fulfillment of fulfillments) {
        if (fulfillment.status !== "closing" /* CLOSING */) continue;
        const exchange = exchanges.find((item) => item.id === fulfillment.exchange_id);
        if (!hasLostCompletionCondition(exchange, items)) continue;
        next = upsertFulfillment(next, {
          ...fulfillment,
          status: "confirming" /* CONFIRMING */,
          updated_at: now3
        });
        released.push(fulfillment.exchange_id);
      }
      for (const fulfillment of next) {
        if (fulfillment.status !== "blocked" /* BLOCKED */) continue;
        const exchange = exchanges.find((item) => item.id === fulfillment.exchange_id);
        if (!exchange || exchange.status !== "accepted" /* ACCEPTED */) continue;
        if (findItemConflict(exchange, next, exchanges, items, fulfillment.id)) continue;
        next = upsertFulfillment(next, {
          ...fulfillment,
          status: "confirming" /* CONFIRMING */,
          blocked_at: null,
          updated_at: now3
        });
        unblocked.push(fulfillment.exchange_id);
      }
      if (released.length || unblocked.length) {
        tx.set(STORAGE_KEYS.fulfillments, next);
      }
      return { released, unblocked };
    });
  },
  async confirm(exchangeId, userId) {
    await this.releaseStaleClaims();
    const claim = await storage.atomic(FULFILLMENT_TX_KEYS, async (tx) => {
      const [fulfillmentsBefore, exchanges, items] = await Promise.all([
        tx.get(STORAGE_KEYS.fulfillments, []),
        tx.get(STORAGE_KEYS.exchanges, []),
        tx.get(STORAGE_KEYS.items, [])
      ]);
      let fulfillments = fulfillmentsBefore;
      const exchange = exchanges.find((item) => item.id === exchangeId);
      if (!exchange) throw new Error(FULFILLMENT_MESSAGES.exchangeMissing);
      let current = fulfillments.find((item) => item.exchange_id === exchangeId);
      const now3 = (/* @__PURE__ */ new Date()).toISOString();
      if (exchange.status === "completed" /* COMPLETED */ || current?.status === "completed" /* COMPLETED */) {
        if (!current) throw new Error(FULFILLMENT_MESSAGES.fulfillmentMissing);
        return { kind: "done", fulfillment: current, exchange };
      }
      if (current?.status === "blocked" /* BLOCKED */) {
        const stillBlocked = exchange.status !== "accepted" /* ACCEPTED */ || findItemConflict(exchange, fulfillments, exchanges, items, current.id) !== "";
        if (stillBlocked) {
          return { kind: "blocked", fulfillment: current, exchange };
        }
        const unblockedFulfillment = {
          ...current,
          status: "confirming" /* CONFIRMING */,
          blocked_at: null,
          updated_at: now3
        };
        fulfillments = upsertFulfillment(fulfillments, unblockedFulfillment);
        tx.set(STORAGE_KEYS.fulfillments, fulfillments);
        current = unblockedFulfillment;
      }
      const invalidMessage = validateFulfillmentConfirm(exchange, userId);
      if (invalidMessage) throw new Error(invalidMessage);
      const fulfillment = current ?? buildFulfillment(exchange, fulfillments);
      if (fulfillment.status === "closing" /* CLOSING */) {
        return { kind: "finalize", fulfillment, exchange };
      }
      const bothPartiesConfirmed = [exchange.from_user_id, exchange.to_user_id].every(
        (partyId) => fulfillment.confirmations.some((item) => item.user_id === partyId)
      );
      if (bothPartiesConfirmed) {
        const conflict2 = findItemConflict(exchange, fulfillments, exchanges, items, fulfillment.id);
        if (conflict2 === "missing") throw new Error(FULFILLMENT_MESSAGES.itemMissing);
        if (conflict2 === "conflict") {
          const blockedFulfillment = {
            ...fulfillment,
            status: "blocked" /* BLOCKED */,
            blocked_at: now3,
            updated_at: now3
          };
          tx.set(STORAGE_KEYS.fulfillments, upsertFulfillment(fulfillments, blockedFulfillment));
          return { kind: "blocked", fulfillment: blockedFulfillment, exchange };
        }
        const closingFulfillment2 = {
          ...fulfillment,
          status: "closing" /* CLOSING */,
          updated_at: now3
        };
        tx.set(STORAGE_KEYS.fulfillments, upsertFulfillment(fulfillments, closingFulfillment2));
        return { kind: "finalize", fulfillment: closingFulfillment2, exchange };
      }
      if (fulfillment.confirmations.some((item) => item.user_id === userId)) {
        return { kind: "duplicate", fulfillment, exchange };
      }
      const role = userId === exchange.from_user_id ? "initiator" : "receiver";
      const confirmation = { user_id: userId, role, confirmed_at: now3 };
      const nextConfirmations = [...fulfillment.confirmations, confirmation];
      const bothConfirmed = [exchange.from_user_id, exchange.to_user_id].every(
        (partyId) => nextConfirmations.some((item) => item.user_id === partyId)
      );
      if (!bothConfirmed) {
        const nextFulfillment = {
          ...fulfillment,
          confirmations: nextConfirmations,
          updated_at: now3
        };
        tx.set(STORAGE_KEYS.fulfillments, upsertFulfillment(fulfillments, nextFulfillment));
        return { kind: "partial", fulfillment: nextFulfillment, exchange };
      }
      const conflict = findItemConflict(exchange, fulfillments, exchanges, items, fulfillment.id);
      if (conflict === "missing") throw new Error(FULFILLMENT_MESSAGES.itemMissing);
      if (conflict === "conflict") {
        const blockedFulfillment = {
          ...fulfillment,
          status: "blocked" /* BLOCKED */,
          blocked_at: now3,
          updated_at: now3
        };
        tx.set(STORAGE_KEYS.fulfillments, upsertFulfillment(fulfillments, blockedFulfillment));
        return { kind: "blocked", fulfillment: blockedFulfillment, exchange };
      }
      const closingFulfillment = {
        ...fulfillment,
        confirmations: nextConfirmations,
        status: "closing" /* CLOSING */,
        updated_at: now3
      };
      tx.set(STORAGE_KEYS.fulfillments, upsertFulfillment(fulfillments, closingFulfillment));
      return { kind: "finalize", fulfillment: closingFulfillment, exchange };
    });
    if (claim.kind === "blocked") throw new Error(FULFILLMENT_MESSAGES.itemConflict);
    if (claim.kind === "done" || claim.kind === "duplicate") {
      return {
        fulfillment: claim.fulfillment,
        exchange: claim.exchange,
        completed: false,
        alreadyConfirmed: true
      };
    }
    if (claim.kind === "partial") {
      return {
        fulfillment: claim.fulfillment,
        exchange: claim.exchange,
        completed: false,
        alreadyConfirmed: false
      };
    }
    return this.finalizeClaim(claim.fulfillment.exchange_id);
  },
  /** 收口已认领的履约：交换完成 + 两张物品写回，整体原子提交 */
  async finalizeClaim(exchangeId) {
    return storage.atomic(FULFILLMENT_TX_KEYS, async (tx) => {
      const [fulfillments, exchanges, items] = await Promise.all([
        tx.get(STORAGE_KEYS.fulfillments, []),
        tx.get(STORAGE_KEYS.exchanges, []),
        tx.get(STORAGE_KEYS.items, [])
      ]);
      const exchange = exchanges.find((item) => item.id === exchangeId);
      if (!exchange) throw new Error(FULFILLMENT_MESSAGES.exchangeMissing);
      const current = fulfillments.find((item) => item.exchange_id === exchangeId);
      if (!current) throw new Error(FULFILLMENT_MESSAGES.fulfillmentMissing);
      if (exchange.status === "completed" /* COMPLETED */ || current.status === "completed" /* COMPLETED */) {
        return { fulfillment: current, exchange, completed: false, alreadyConfirmed: true };
      }
      if (current.status !== "closing" /* CLOSING */) {
        throw new Error(FULFILLMENT_MESSAGES.notReady);
      }
      const conflict = findItemConflict(exchange, fulfillments, exchanges, items, current.id);
      if (conflict === "missing") throw new Error(FULFILLMENT_MESSAGES.itemMissing);
      if (conflict === "conflict") throw new Error(FULFILLMENT_MESSAGES.itemConflict);
      const now3 = (/* @__PURE__ */ new Date()).toISOString();
      const completedFulfillment = {
        ...current,
        status: "completed" /* COMPLETED */,
        updated_at: now3,
        completed_at: now3
      };
      const nextExchange = {
        ...exchange,
        status: "completed" /* COMPLETED */,
        updated_at: now3
      };
      const nextItems = items.map(
        (item) => item.id === exchange.from_item_id || item.id === exchange.to_item_id ? { ...item, status: "exchanged" /* EXCHANGED */ } : item
      );
      tx.set(STORAGE_KEYS.fulfillments, upsertFulfillment(fulfillments, completedFulfillment));
      tx.set(
        STORAGE_KEYS.exchanges,
        exchanges.map((item) => item.id === exchangeId ? nextExchange : item)
      );
      tx.set(STORAGE_KEYS.items, nextItems);
      return {
        fulfillment: completedFulfillment,
        exchange: nextExchange,
        completed: true,
        alreadyConfirmed: false
      };
    });
  }
};

// src/api/itemApi.ts
var seedItems = [
  {
    id: "item_camera",
    user_id: "user_lin",
    title: "\u5BCC\u58EB\u62CD\u7ACB\u5F97 Mini \u65E7\u673A",
    description: "\u6210\u8272\u5E72\u51C0\uFF0C\u9644\u4E00\u5305\u76F8\u7EB8\uFF0C\u60F3\u6362\u5C0F\u578B\u84DD\u7259\u97F3\u7BB1\u6216\u684C\u9762\u706F\u3002",
    category: "\u6570\u7801",
    condition: "good" /* GOOD */,
    images: [],
    status: "available" /* AVAILABLE */,
    location: "\u676D\u5DDE \xB7 \u897F\u6E56",
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "item_books",
    user_id: "user_chen",
    title: "\u8BBE\u8BA1\u4E0E\u4EA7\u54C1\u4E66 6 \u672C",
    description: "\u642C\u5BB6\u6E05\u4E66\u67DC\uFF0C\u9002\u5408\u4EA7\u54C1/\u89C6\u89C9\u5165\u95E8\uFF0C\u63A5\u53D7\u6362\u7EFF\u690D\u3001\u5496\u5561\u5668\u5177\u3002",
    category: "\u4E66\u7C4D",
    condition: "like_new" /* LIKE_NEW */,
    images: [],
    status: "available" /* AVAILABLE */,
    location: "\u82CF\u5DDE \xB7 \u5DE5\u4E1A\u56ED",
    created_at: new Date(Date.now() - 1e3 * 60 * 60 * 26).toISOString()
  },
  {
    id: "item_chair",
    user_id: "user_me",
    title: "\u53EF\u6298\u53E0\u9732\u8425\u6905",
    description: "\u53BB\u5E74\u4E70\u7684\uFF0C\u9732\u8425\u4E24\u6B21\uFF0C\u6709\u8F7B\u5FAE\u4F7F\u7528\u75D5\u8FF9\uFF0C\u60F3\u6362\u6536\u7EB3\u76D2\u3002",
    category: "\u8FD0\u52A8",
    condition: "good" /* GOOD */,
    images: [],
    status: "available" /* AVAILABLE */,
    location: "\u4E0A\u6D77 \xB7 \u5F90\u6C47",
    created_at: new Date(Date.now() - 1e3 * 60 * 60 * 3).toISOString()
  },
  {
    id: "item_lamp",
    user_id: "user_lin",
    title: "\u6728\u8D28\u5C0F\u591C\u706F",
    description: "\u6696\u5149\uFF0C\u9002\u5408\u5E8A\u5934\u3002\u5DF2\u5B8C\u6210\u4EA4\u6362\uFF0C\u4FDD\u7559\u8BB0\u5F55\u7528\u4E8E\u72B6\u6001\u5C55\u793A\u3002",
    category: "\u5BB6\u5C45",
    condition: "like_new" /* LIKE_NEW */,
    images: [],
    status: "exchanged" /* EXCHANGED */,
    location: "\u676D\u5DDE \xB7 \u897F\u6E56",
    created_at: new Date(Date.now() - 1e3 * 60 * 60 * 90).toISOString()
  }
];
var itemApi = {
  async list() {
    const items = await storage.get(STORAGE_KEYS.items, []);
    if (items.length) return items;
    await storage.set(STORAGE_KEYS.items, seedItems);
    return seedItems;
  },
  async detail(id) {
    const items = await this.list();
    return items.find((item) => item.id === id);
  },
  async create(draft) {
    await this.list();
    const nextItem = {
      ...draft,
      id: storage.createId("item"),
      status: draft.status ?? "available" /* AVAILABLE */,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    await storage.mutate(STORAGE_KEYS.items, [], (items) => [nextItem, ...items]);
    return nextItem;
  },
  async update(id, patch) {
    await this.list();
    let nextItem;
    await storage.mutate(STORAGE_KEYS.items, [], (items) => {
      const current = items.find((item) => item.id === id);
      if (!current) throw new Error("\u7269\u54C1\u4E0D\u5B58\u5728");
      const merged = { ...current, ...patch };
      nextItem = merged;
      return items.map((item) => item.id === id ? merged : item);
    });
    if (!nextItem) throw new Error("\u7269\u54C1\u4E0D\u5B58\u5728");
    return nextItem;
  },
  async setStatus(id, status) {
    return this.update(id, { status });
  }
};

// src/api/exchangeApi.ts
var seedExchanges = [
  {
    id: "exchange_seed",
    from_user_id: "user_me",
    to_user_id: "user_lin",
    from_item_id: "item_chair",
    to_item_id: "item_camera",
    status: "pending" /* PENDING */,
    message: "\u9732\u8425\u6905\u6362\u62CD\u7ACB\u5F97\uFF0C\u53EF\u4EE5\u540C\u57CE\u5F53\u9762\u4EA4\u6362\u3002",
    created_at: new Date(Date.now() - 1e3 * 60 * 60).toISOString(),
    updated_at: new Date(Date.now() - 1e3 * 60 * 60).toISOString()
  }
];
var exchangeApi = {
  async list() {
    const exchanges = await storage.get(STORAGE_KEYS.exchanges, []);
    if (exchanges.length) return exchanges;
    await storage.set(STORAGE_KEYS.exchanges, seedExchanges);
    return seedExchanges;
  },
  async create(draft) {
    await this.list();
    const targetItem = await itemApi.detail(draft.to_item_id);
    if (!targetItem || targetItem.status !== "available" /* AVAILABLE */) {
      throw new Error("\u76EE\u6807\u7269\u54C1\u5F53\u524D\u4E0D\u53EF\u4EA4\u6362");
    }
    const nextExchange = {
      ...draft,
      id: storage.createId("exchange"),
      status: draft.status ?? "pending" /* PENDING */,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    await storage.mutate(STORAGE_KEYS.exchanges, [], (exchanges) => [
      nextExchange,
      ...exchanges
    ]);
    return nextExchange;
  },
  async transition(id, status) {
    await this.list();
    let previousExchange;
    let nextExchange;
    await storage.mutate(STORAGE_KEYS.exchanges, [], (exchanges) => {
      const current = exchanges.find((item) => item.id === id);
      if (!current) throw new Error("\u4EA4\u6362\u8BF7\u6C42\u4E0D\u5B58\u5728");
      if (!EXCHANGE_ACTION_FLOW[current.status].includes(status)) {
        throw new Error("\u5F53\u524D\u72B6\u6001\u4E0D\u5141\u8BB8\u8BE5\u64CD\u4F5C");
      }
      if (status === "completed" /* COMPLETED */) {
        throw new Error(FULFILLMENT_MESSAGES.directCompleteForbidden);
      }
      previousExchange = current;
      const updated = { ...current, status, updated_at: (/* @__PURE__ */ new Date()).toISOString() };
      nextExchange = updated;
      return exchanges.map((item) => item.id === id ? updated : item);
    });
    if (!nextExchange) throw new Error("\u4EA4\u6362\u8BF7\u6C42\u4E0D\u5B58\u5728");
    const committedExchange = nextExchange;
    if (status === "accepted" /* ACCEPTED */) {
      try {
        await fulfillmentApi.ensureForExchange(committedExchange);
      } catch (error) {
        const fallback = previousExchange;
        await storage.mutate(
          STORAGE_KEYS.exchanges,
          [],
          (exchanges) => exchanges.map((item) => item.id === id && fallback ? fallback : item)
        );
        throw error;
      }
    }
    return committedExchange;
  }
};

// scripts/persistence-regression/suite.ts
var now2 = () => (/* @__PURE__ */ new Date()).toISOString();
var makeItem = (id, userId) => ({
  id,
  user_id: userId,
  title: `\u7269\u54C1${id}`,
  description: "\u56DE\u5F52\u6D4B\u8BD5\u7269\u54C1",
  category: "\u6570\u7801",
  condition: "good",
  images: [],
  status: "available",
  location: "\u4E0A\u6D77",
  created_at: now2()
});
var makeExchange = (id, fromItem, toItem, status = "pending", fromUser = "user_a", toUser = "user_b") => ({
  id,
  from_user_id: fromUser,
  to_user_id: toUser,
  from_item_id: fromItem,
  to_item_id: toItem,
  status,
  message: "",
  created_at: now2(),
  updated_at: now2()
});
var PERSISTED_KEYS = [STORAGE_KEYS.exchanges, STORAGE_KEYS.fulfillments, STORAGE_KEYS.items];
var reload = async () => ({
  exchanges: await storage.get(STORAGE_KEYS.exchanges, []),
  fulfillments: await storage.get(STORAGE_KEYS.fulfillments, []),
  items: await storage.get(STORAGE_KEYS.items, [])
});
var findDuplicate = (list, keyOf) => {
  const seen = /* @__PURE__ */ new Set();
  for (const entry of list) {
    const key = keyOf(entry);
    if (seen.has(key)) return key;
    seen.add(key);
  }
  return null;
};
var assertPersistenceSync = (stageName) => {
  const idbDump = __dump();
  for (const key of PERSISTED_KEYS) {
    const localRaw = localStorage.getItem(key);
    const idbValue = idbDump[key];
    if (!localRaw && !idbValue) continue;
    const localPayload = localRaw ? JSON.stringify(JSON.parse(localRaw).payload) : null;
    const idbPayload = idbValue ? JSON.stringify(idbValue.payload) : null;
    if (localPayload !== idbPayload) {
      throw new Error(`\u9636\u6BB5\u300C${stageName}\u300D\u6301\u4E45\u5C42\u4E0D\u4E00\u81F4\uFF1A${key} \u7684 localStorage \u4E0E IndexedDB \u5185\u5BB9\u4E0D\u540C`);
    }
  }
};
var assertNoDuplicates = (stageName, snap) => {
  const dupExchange = findDuplicate(snap.exchanges, (e) => e.id);
  if (dupExchange) throw new Error(`\u9636\u6BB5\u300C${stageName}\u300D\u53D1\u73B0\u91CD\u590D\u4EA4\u6362\u8BB0\u5F55\uFF1A${dupExchange}`);
  const dupFulfillment = findDuplicate(snap.fulfillments, (f) => f.id);
  if (dupFulfillment) throw new Error(`\u9636\u6BB5\u300C${stageName}\u300D\u53D1\u73B0\u91CD\u590D\u5C65\u7EA6\u5355\uFF1A${dupFulfillment}`);
  const dupBinding = findDuplicate(snap.fulfillments, (f) => f.exchange_id);
  if (dupBinding) throw new Error(`\u9636\u6BB5\u300C${stageName}\u300D\u4EA4\u6362 ${dupBinding} \u7ED1\u5B9A\u4E86\u591A\u5F20\u5C65\u7EA6\u5355`);
  const dupCode = findDuplicate(snap.fulfillments, (f) => f.code);
  if (dupCode) throw new Error(`\u9636\u6BB5\u300C${stageName}\u300D\u53D1\u73B0\u91CD\u590D\u5C65\u7EA6\u7801\uFF1A${dupCode}`);
  for (const fulfillment of snap.fulfillments) {
    const dupUser = findDuplicate(fulfillment.confirmations, (c) => c.user_id);
    if (dupUser) {
      throw new Error(`\u9636\u6BB5\u300C${stageName}\u300D\u5C65\u7EA6\u5355 ${fulfillment.id} \u53D1\u73B0 ${dupUser} \u7684\u91CD\u590D\u786E\u8BA4\u8BB0\u5F55`);
    }
  }
};
var assertConsistency = (stageName, snap) => {
  for (const exchange of snap.exchanges) {
    const fulfillment = snap.fulfillments.find((f) => f.exchange_id === exchange.id);
    if (exchange.status === "completed") {
      if (!fulfillment || fulfillment.status !== "completed") {
        throw new Error(`\u9636\u6BB5\u300C${stageName}\u300D\u4EA4\u6362 ${exchange.id} \u5DF2\u5B8C\u6210\u4F46\u5C65\u7EA6\u5355\u4E0D\u662F\u5B8C\u6210\u6001`);
      }
      if (fulfillment.confirmations.length !== 2) {
        throw new Error(`\u9636\u6BB5\u300C${stageName}\u300D\u4EA4\u6362 ${exchange.id} \u5DF2\u5B8C\u6210\u4F46\u786E\u8BA4\u8BB0\u5F55\u4E0D\u662F 2 \u6761`);
      }
      for (const itemId of [exchange.from_item_id, exchange.to_item_id]) {
        const item = snap.items.find((i) => i.id === itemId);
        if (item?.status !== "exchanged") {
          throw new Error(`\u9636\u6BB5\u300C${stageName}\u300D\u4EA4\u6362 ${exchange.id} \u5DF2\u5B8C\u6210\u4F46\u7269\u54C1 ${itemId} \u4E0D\u662F\u5DF2\u4EA4\u6362`);
        }
      }
    }
    if (fulfillment?.status === "completed" && exchange.status !== "completed") {
      throw new Error(`\u9636\u6BB5\u300C${stageName}\u300D\u5C65\u7EA6\u5355 ${fulfillment.id} \u5DF2\u5B8C\u6210\u4F46\u4EA4\u6362 ${exchange.id} \u4E0D\u662F\u5B8C\u6210\u6001`);
    }
  }
};
var currentStage = "(\u521D\u59CB\u5316)";
var reloadAndCheck = async (stageName) => {
  const snap = await reload();
  assertPersistenceSync(stageName);
  assertNoDuplicates(stageName, snap);
  assertConsistency(stageName, snap);
  console.log(`  \u2713 \u91CD\u65B0\u52A0\u8F7D\u6821\u9A8C\u901A\u8FC7\uFF08\u4EA4\u6362 ${snap.exchanges.length} / \u5C65\u7EA6 ${snap.fulfillments.length} / \u7269\u54C1 ${snap.items.length}\uFF09`);
  return snap;
};
var stage = async (name, action) => {
  currentStage = name;
  console.log(`
\u25B6 \u9636\u6BB5\uFF1A${name}`);
  await action();
  return reloadAndCheck(name);
};
var replay = async (name, action) => {
  console.log(`  \u21BB \u91CD\u653E\uFF1A${name}`);
  await action();
  return reloadAndCheck(`\u91CD\u653E\xB7${name}`);
};
var expectThrow = async (fn, pattern, label) => {
  try {
    await fn();
  } catch (error) {
    if (pattern.test(error.message)) return;
    throw new Error(`\u9636\u6BB5\u300C${currentStage}\u300D${label} \u629B\u51FA\u4E86\u975E\u9884\u671F\u9519\u8BEF\uFF1A${error.message}`);
  }
  throw new Error(`\u9636\u6BB5\u300C${currentStage}\u300D${label} \u672C\u5E94\u5931\u8D25\u5374\u6210\u529F\u4E86`);
};
var check = (name, cond) => {
  if (!cond) throw new Error(`\u9636\u6BB5\u300C${currentStage}\u300D\u65AD\u8A00\u5931\u8D25\uFF1A${name}`);
  console.log(`  \u2713 ${name}`);
};
var scenarioLifecycle = async () => {
  console.log("\n\u2550\u2550 \u573A\u666F\u4E00\uFF1A\u5355\u4EA4\u6362\u5168\u751F\u547D\u5468\u671F \u2550");
  await storage.set(STORAGE_KEYS.items, [makeItem("item_a1", "user_a"), makeItem("item_b1", "user_b")]);
  await storage.set(STORAGE_KEYS.exchanges, [makeExchange("ex_1", "item_a1", "item_b1")]);
  await storage.set(STORAGE_KEYS.fulfillments, []);
  await stage("\u53D1\u8D77\u4EA4\u6362\u8BF7\u6C42\u5DF2\u843D\u5E93", async () => {
    const snap = await reload();
    check("\u4EA4\u6362\u8BF7\u6C42\u5B58\u5728\u4E14\u5F85\u786E\u8BA4", snap.exchanges.find((e) => e.id === "ex_1")?.status === "pending");
  });
  await stage("\u540C\u610F\u4EA4\u6362\u5E76\u751F\u6210\u5C65\u7EA6\u7801", async () => {
    await exchangeApi.transition("ex_1", "accepted");
  });
  const code1 = (await fulfillmentApi.getByExchange("ex_1")).code;
  check("\u5C65\u7EA6\u7801\u683C\u5F0F\u6B63\u786E", /^RS-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code1));
  await replay("\u91CD\u590D\u540C\u610F\uFF08\u9884\u671F\u72B6\u6001\u673A\u62D2\u7EDD\uFF09", async () => {
    await expectThrow(() => exchangeApi.transition("ex_1", "accepted"), /不允许/, "\u91CD\u590D\u540C\u610F");
  });
  await replay("\u7ED5\u8FC7\u5C65\u7EA6\u76F4\u63A5\u5B8C\u6210\uFF08\u9884\u671F\u88AB\u7981\u6B62\uFF09", async () => {
    await expectThrow(() => exchangeApi.transition("ex_1", "completed"), /履约/, "\u5355\u8FB9\u5B8C\u6210");
  });
  await stage("\u53D1\u8D77\u65B9\u786E\u8BA4\u5C65\u7EA6", async () => {
    await fulfillmentApi.confirm("ex_1", "user_a");
  });
  await replay("\u53D1\u8D77\u65B9\u91CD\u590D\u786E\u8BA4\uFF08\u5E42\u7B49\uFF09", async () => {
    const result = await fulfillmentApi.confirm("ex_1", "user_a");
    check("\u91CD\u590D\u786E\u8BA4\u5E42\u7B49\u8FD4\u56DE", result.alreadyConfirmed === true && result.completed === false);
  });
  await stage("\u63A5\u6536\u65B9\u786E\u8BA4\u5E76\u5B8C\u6210", async () => {
    const result = await fulfillmentApi.confirm("ex_1", "user_b");
    check("\u53CC\u65B9\u786E\u8BA4\u540E\u5B8C\u6210", result.completed === true);
  });
  await replay("\u5B8C\u6210\u540E\u53CC\u65B9\u53CD\u590D\u91CD\u8BD5\uFF08\u5E42\u7B49\uFF09", async () => {
    await fulfillmentApi.confirm("ex_1", "user_a");
    await fulfillmentApi.confirm("ex_1", "user_b");
  });
  const finalSnap = await stage("\u5B8C\u6210\u540E\u53CD\u590D\u5237\u65B0\u8BFB\u53D6", async () => {
    const first = JSON.stringify(await reload());
    await reload();
    const second = JSON.stringify(await reload());
    check("\u8FDE\u7EED\u5237\u65B0\u8BFB\u53D6\u7ED3\u679C\u4E00\u81F4", first === second);
  });
  check("\u4EA4\u6362\u6700\u7EC8\u5B8C\u6210", finalSnap.exchanges.find((e) => e.id === "ex_1").status === "completed");
  check("\u4E24\u5F20\u7269\u54C1\u90FD\u5DF2\u4EA4\u6362", finalSnap.items.every((i) => i.status === "exchanged"));
  check("\u5C65\u7EA6\u7801\u5168\u7A0B\u4E0D\u53D8", finalSnap.fulfillments.find((f) => f.exchange_id === "ex_1").code === code1);
};
var scenarioConflict = async () => {
  console.log("\n\u2550\u2550 \u573A\u666F\u4E8C\uFF1A\u5E76\u53D1\u540C\u610F\u4E0E\u5171\u4EAB\u7269\u54C1\u5F52\u5C5E\u51B2\u7A81 \u2550");
  await storage.set(STORAGE_KEYS.items, [
    makeItem("item_x", "user_a"),
    makeItem("item_y", "user_b"),
    makeItem("item_z", "user_c")
  ]);
  await storage.set(STORAGE_KEYS.exchanges, [
    makeExchange("ex_2a", "item_x", "item_y"),
    makeExchange("ex_2b", "item_x", "item_z", "pending", "user_a", "user_c")
  ]);
  await storage.set(STORAGE_KEYS.fulfillments, []);
  await stage("\u4E24\u6761\u4EA4\u6362\u540C\u65F6\u83B7\u540C\u610F", async () => {
    await Promise.all([
      exchangeApi.transition("ex_2a", "accepted"),
      exchangeApi.transition("ex_2b", "accepted")
    ]);
  });
  const snapAfterAccept = await reload();
  check("\u4E24\u6761\u4EA4\u6362\u90FD\u5DF2\u540C\u610F", snapAfterAccept.exchanges.every((e) => e.status === "accepted"));
  check("\u4E24\u5F20\u5C65\u7EA6\u5355\u5404\u81EA\u5B58\u5728", snapAfterAccept.fulfillments.length === 2);
  await stage("\u4E24\u6761\u4EA4\u6362\u7684\u7B2C\u4E00\u65B9\u5206\u522B\u786E\u8BA4", async () => {
    await fulfillmentApi.confirm("ex_2a", "user_a");
    await fulfillmentApi.confirm("ex_2b", "user_a");
  });
  await stage("\u4E24\u6761\u4EA4\u6362\u51E0\u4E4E\u540C\u65F6\u5B8C\u6210\u786E\u8BA4", async () => {
    await Promise.allSettled([
      fulfillmentApi.confirm("ex_2a", "user_b"),
      fulfillmentApi.confirm("ex_2b", "user_c")
    ]);
  });
  const conflictSnap = await reload();
  const completed = conflictSnap.exchanges.filter((e) => e.status === "completed");
  const stillAccepted = conflictSnap.exchanges.filter((e) => e.status === "accepted");
  check("\u53EA\u6709\u4E00\u6761\u4EA4\u6362\u5B8C\u6210", completed.length === 1);
  check("\u53E6\u4E00\u6761\u4FDD\u6301\u5DF2\u540C\u610F", stillAccepted.length === 1);
  const loserId = stillAccepted[0].id;
  const loserF = conflictSnap.fulfillments.find((f) => f.exchange_id === loserId);
  check("\u843D\u8D25\u65B9\u53D7\u963B\u4E14\u53EA\u6709 1 \u6761\u786E\u8BA4", loserF.status === "blocked" && loserF.confirmations.length === 1);
  check("\u5171\u4EAB\u7269\u54C1\u53EA\u5199\u56DE\u4E00\u6B21", conflictSnap.items.find((i) => i.id === "item_x").status === "exchanged");
  await replay("\u843D\u8D25\u65B9\u91CD\u590D\u786E\u8BA4\uFF08\u4ECD\u53D7\u963B\uFF0C\u65E0\u91CD\u590D\u8BB0\u5F55\uFF09", async () => {
    const loserSecond = loserId === "ex_2a" ? "user_b" : "user_c";
    await expectThrow(() => fulfillmentApi.confirm(loserId, loserSecond), /占用|受阻/, "\u843D\u8D25\u65B9\u91CD\u8BD5");
  });
  await replay("\u83B7\u80DC\u65B9\u5B8C\u6210\u540E\u91CD\u8BD5\uFF08\u5E42\u7B49\uFF09", async () => {
    const winnerId = completed[0].id;
    const winnerSecond = winnerId === "ex_2a" ? "user_b" : "user_c";
    const result = await fulfillmentApi.confirm(winnerId, winnerSecond);
    check("\u83B7\u80DC\u65B9\u91CD\u8BD5\u5E42\u7B49", result.alreadyConfirmed === true && result.completed === false);
  });
};
var scenarioRecovery = async () => {
  console.log("\n\u2550\u2550 \u573A\u666F\u4E09\uFF1A\u6536\u53E3\u5931\u8D25\u56DE\u6EDA\u4E0E\u53D7\u963B\u6062\u590D \u2550");
  await storage.set(STORAGE_KEYS.items, [
    makeItem("item_x3", "user_a"),
    makeItem("item_y3", "user_b"),
    makeItem("item_z3", "user_c")
  ]);
  await storage.set(STORAGE_KEYS.exchanges, [
    makeExchange("ex_3a", "item_x3", "item_y3"),
    makeExchange("ex_3b", "item_x3", "item_z3", "pending", "user_a", "user_c")
  ]);
  await storage.set(STORAGE_KEYS.fulfillments, []);
  await Promise.all([
    exchangeApi.transition("ex_3a", "accepted"),
    exchangeApi.transition("ex_3b", "accepted")
  ]);
  await fulfillmentApi.confirm("ex_3a", "user_a");
  await fulfillmentApi.confirm("ex_3b", "user_a");
  await stage("\u8BA4\u9886\u65B9\u6536\u53E3\u5199\u5165\u5931\u8D25\uFF08\u6CE8\u5165\uFF09", async () => {
    __failOnceFor.key = STORAGE_KEYS.items;
    await expectThrow(() => fulfillmentApi.confirm("ex_3a", "user_b"), /injected|failure/, "\u6536\u53E3\u5199\u5165\u5931\u8D25");
  });
  const afterFail = await reload();
  check("\u8BA4\u9886\u65B9\u4FDD\u6301\u6536\u53E3\u6267\u884C\u4E2D", afterFail.fulfillments.find((f) => f.exchange_id === "ex_3a").status === "closing");
  check("\u5931\u8D25\u540E\u7269\u54C1\u672A\u53D8\u66F4", afterFail.items.every((i) => i.status === "available"));
  await stage("\u7B49\u5F85\u65B9\u5B8C\u6210\u786E\u8BA4\u88AB\u963B", async () => {
    await expectThrow(() => fulfillmentApi.confirm("ex_3b", "user_c"), /占用|受阻/, "\u7B49\u5F85\u65B9\u786E\u8BA4");
  });
  await stage("\u8BA4\u9886\u65B9\u5931\u53BB\u5B8C\u6210\u6761\u4EF6\uFF08\u7269\u54C1\u4E0B\u67B6\uFF09\u540E\u91CA\u653E", async () => {
    await itemApi.setStatus("item_y3", "offline");
    const sweep = await fulfillmentApi.releaseStaleClaims();
    check("\u91CA\u653E\u8FD4\u56DE\u8BA4\u9886\u65B9", sweep.released.includes("ex_3a"));
    check("\u91CA\u653E\u8FD4\u56DE\u7B49\u5F85\u65B9", sweep.unblocked.includes("ex_3b"));
  });
  const afterRelease = await reload();
  check("\u8BA4\u9886\u65B9\u56DE\u5230\u786E\u8BA4\u4E2D\u4E14\u786E\u8BA4\u4FDD\u7559", afterRelease.fulfillments.find((f) => f.exchange_id === "ex_3a").status === "confirming" && afterRelease.fulfillments.find((f) => f.exchange_id === "ex_3a").confirmations.length === 2);
  check("\u7B49\u5F85\u65B9\u89E3\u9664\u53D7\u963B", afterRelease.fulfillments.find((f) => f.exchange_id === "ex_3b").status === "confirming");
  await replay("\u91CD\u590D\u91CA\u653E\uFF08\u5E42\u7B49\uFF09", async () => {
    const again = await fulfillmentApi.releaseStaleClaims();
    check("\u65E0\u53EF\u91CA\u653E\u5BF9\u8C61", again.released.length === 0 && again.unblocked.length === 0);
  });
  await stage("\u7B49\u5F85\u65B9\u7B2C\u4E8C\u65B9\u786E\u8BA4\u540E\u5B8C\u6210", async () => {
    const result = await fulfillmentApi.confirm("ex_3b", "user_c");
    check("\u7B49\u5F85\u65B9\u5B8C\u6210", result.completed === true);
  });
  await stage("\u539F\u8BA4\u9886\u65B9\u91CD\u8BD5\uFF08\u7269\u54C1\u5DF2\u4E0B\u67B6\uFF0C\u53D7\u963B\uFF09", async () => {
    await expectThrow(() => fulfillmentApi.confirm("ex_3a", "user_b"), /占用|受阻/, "\u539F\u8BA4\u9886\u65B9\u91CD\u8BD5");
  });
  const finalSnap = await reload();
  const f3a = finalSnap.fulfillments.find((f) => f.exchange_id === "ex_3a");
  check("\u539F\u8BA4\u9886\u65B9\u53D7\u963B\u4F46\u53CC\u65B9\u786E\u8BA4\u4FDD\u7559", f3a.status === "blocked" && f3a.confirmations.length === 2);
  check("\u4E0B\u67B6\u7269\u54C1\u672A\u88AB\u8BEF\u5199", finalSnap.items.find((i) => i.id === "item_y3").status === "offline");
};
var scenarioStability = async () => {
  console.log("\n\u2550\u2550 \u573A\u666F\u56DB\uFF1A\u5168\u91CF\u91CD\u653E\u4E0E\u8FDE\u7EED\u5237\u65B0\u7A33\u5B9A\u6027 \u2550");
  await stage("\u91CD\u653E\u5168\u90E8\u4EA4\u6362\u7684\u53CC\u65B9\u786E\u8BA4\uFF08\u5E42\u7B49/\u53D7\u963B\uFF0C\u4E0D\u4EA7\u751F\u91CD\u590D\uFF09", async () => {
    const { exchanges } = await reload();
    for (const exchange of exchanges) {
      for (const userId of [exchange.from_user_id, exchange.to_user_id]) {
        await fulfillmentApi.confirm(exchange.id, userId).catch(() => null);
      }
    }
  });
  await stage("\u8FDE\u7EED\u4E09\u6B21\u5237\u65B0\u8BFB\u53D6\u7ED3\u679C\u4E00\u81F4", async () => {
    const first = JSON.stringify(await reload());
    await reload();
    await reload();
    const third = JSON.stringify(await reload());
    check("\u4E09\u6B21\u5237\u65B0\u5FEB\u7167\u4E00\u81F4", first === third);
  });
  const finalSnap = await reload();
  const completedCount = finalSnap.exchanges.filter((e) => e.status === "completed").length;
  const exchangedItems = finalSnap.items.filter((i) => i.status === "exchanged");
  check("\u6700\u7EC8\u5F52\u5C5E\u4E0E\u7269\u54C1\u7ED3\u679C\u4E00\u81F4", exchangedItems.length === completedCount * 2);
  check("\u5C65\u7EA6\u7801\u5168\u5C40\u552F\u4E00", new Set(finalSnap.fulfillments.map((f) => f.code)).size === finalSnap.fulfillments.length);
};
var main = async () => {
  const scenarios = [scenarioLifecycle, scenarioConflict, scenarioRecovery, scenarioStability];
  for (const scenario of scenarios) {
    await scenario();
  }
  console.log("\n\u5168\u90E8\u573A\u666F\u901A\u8FC7\uFF1A\u91CD\u590D\u5237\u65B0\u4E0E\u91CD\u653E\u540E\u65E0\u91CD\u590D\u8BB0\u5F55\uFF0C\u6700\u7EC8\u5F52\u5C5E\u4E0E\u7269\u54C1\u7ED3\u679C\u4E00\u81F4\u3002");
};
main().catch((error) => {
  console.error(`
\u2717 \u56DE\u5F52\u5931\u8D25\uFF0C\u9996\u6B21\u95EE\u9898\u53D1\u751F\u5728\u9636\u6BB5\u300C${currentStage}\u300D`);
  console.error(`  ${error.message}`);
  process.exit(1);
});
