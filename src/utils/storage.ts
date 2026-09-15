import { del, get, set } from 'idb-keyval';

import { LOG_MESSAGES } from '@/constants/messages';
import type { PersistedEnvelope } from '@/types';

const STORAGE_VERSION = 1;
const DEFAULT_TTL = 1000 * 60 * 60 * 24 * 365;

const prefixed = (key: string) => `reswap:${key}`;

export const STORAGE_KEYS = {
  currentUserId: prefixed('current-user-id'),
  users: prefixed('users'),
  items: prefixed('items'),
  exchanges: prefixed('exchanges'),
  fulfillments: prefixed('fulfillments'),
  theme: prefixed('theme'),
  lastClean: prefixed('last-clean'),
};

export interface StorageTransaction {
  get: <T>(key: string, fallback: T) => Promise<T>;
  set: (key: string, payload: unknown) => void;
}

const now = () => Date.now();

const envelope = <T>(payload: T, ttl = DEFAULT_TTL): PersistedEnvelope<T> => ({
  version: STORAGE_VERSION,
  expiresAt: now() + ttl,
  payload,
});

const toPlain = <T>(payload: T): T => JSON.parse(JSON.stringify(payload)) as T;

const isExpired = <T>(data: PersistedEnvelope<T> | null) => {
  if (!data) return false;
  return Boolean(data.expiresAt && data.expiresAt < now());
};

const parseLocal = <T>(key: string): PersistedEnvelope<T> | null => {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedEnvelope<T>;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
};

const writeLocal = <T>(key: string, payload: T, ttl?: number) => {
  localStorage.setItem(key, JSON.stringify(envelope(payload, ttl)));
};

/**
 * 键级串行锁：同一 key 的「读-改-写」在内存队列中排队执行，
 * 多标签页之间用 Web Locks 兜底。这样并发的整表写入各自基于最新值合并，互不覆盖。
 */
const keyChains = new Map<string, Promise<void>>();

const runKeyExclusive = <T>(key: string, task: () => Promise<T>): Promise<T> => {
  const previous = keyChains.get(key) ?? Promise.resolve();
  const run: Promise<T> = previous.then(async () => {
    if (typeof navigator !== 'undefined' && navigator.locks) {
      // await 会递归解包 thenable，类型与运行时都收敛为 T
      return await navigator.locks.request(`reswap:storage:${key}`, () => task());
    }
    return task();
  });
  const tracked: Promise<void> = run.then(
    () => undefined,
    () => undefined,
  );
  keyChains.set(key, tracked);
  const cleanup = () => {
    if (keyChains.get(key) === tracked) keyChains.delete(key);
  };
  tracked.then(cleanup, cleanup);
  return run;
};

/** 多把锁一律按 key 字典序嵌套获取，所有调用方加锁顺序一致，避免死锁 */
const withKeysLocked = <T>(keys: string[], task: () => Promise<T>): Promise<T> => {
  const sorted = [...new Set(keys)].sort();
  const acquire = (index: number): Promise<T> => {
    if (index >= sorted.length) return task();
    return runKeyExclusive(sorted[index], () => acquire(index + 1));
  };
  return acquire(0);
};

/** 快照 + 顺序写入 + 失败回滚；调用方必须已持有这些 key 的锁（仅在 atomic 内调用） */
const commitWrites = async (entries: Array<{ key: string; payload: unknown }>) => {
  if (!entries.length) return;
  const snapshots = await Promise.all(
    entries.map(async (entry) => ({
      key: entry.key,
      previous: await storage.get<unknown>(entry.key, null),
    })),
  );
  const written: string[] = [];
  try {
    for (const entry of entries) {
      // 先登记再写入：单 key 写了一半失败（localStorage 已写、IndexedDB 未写）时也会回滚
      written.push(entry.key);
      await storage.set(entry.key, entry.payload);
    }
  } catch (error) {
    for (const key of [...written].reverse()) {
      const snapshot = snapshots.find((item) => item.key === key);
      try {
        if (snapshot?.previous === null || snapshot?.previous === undefined) {
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

export const storage = {
  async get<T>(key: string, fallback: T): Promise<T> {
    const localEnvelope = parseLocal<T>(key);
    if (isExpired(localEnvelope)) {
      await this.remove(key);
      return fallback;
    }
    if (localEnvelope?.version === STORAGE_VERSION) {
      return localEnvelope.payload;
    }

    const indexedEnvelope = await get<PersistedEnvelope<T>>(key);
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

  async set<T>(key: string, payload: T, ttl?: number): Promise<T> {
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
  async atomic<T>(keys: string[], task: (tx: StorageTransaction) => Promise<T>): Promise<T> {
    const declared = new Set(keys);
    return withKeysLocked(keys, async () => {
      const writes: Array<{ key: string; payload: unknown }> = [];
      const tx: StorageTransaction = {
        get: (key, fallback) => {
          if (!declared.has(key)) throw new Error(`storage.atomic 读取未声明的 key：${key}`);
          return storage.get(key, fallback);
        },
        set: (key, payload) => {
          if (!declared.has(key)) throw new Error(`storage.atomic 写入未声明的 key：${key}`);
          writes.push({ key, payload });
        },
      };
      const result = await task(tx);
      await commitWrites(writes);
      return result;
    });
  },

  /** 单键「读-改-写」：锁内读最新值 → updater 计算 → 写回；updater 抛错则不产生任何写入 */
  async mutate<T>(key: string, fallback: T, updater: (current: T) => T | Promise<T>): Promise<T> {
    return this.atomic([key], async (tx) => {
      const current = await tx.get(key, fallback);
      const next = await updater(current);
      if (next !== current) tx.set(key, next);
      return next;
    });
  },

  /** 多键原子写入：任一 key 失败时按快照回滚已写入的 key */
  async setMany(entries: Array<{ key: string; payload: unknown }>): Promise<void> {
    await this.atomic(entries.map((entry) => entry.key), async (tx) => {
      for (const entry of entries) {
        tx.set(entry.key, entry.payload);
      }
    });
  },

  async remove(key: string): Promise<void> {
    localStorage.removeItem(key);
    await del(key);
  },

  async cleanExpired(): Promise<void> {
    const keys = Object.values(STORAGE_KEYS);
    await Promise.all(
      keys.map(async (key) => {
        const localEnvelope = parseLocal<unknown>(key);
        if (isExpired(localEnvelope)) {
          await this.remove(key);
        }
      }),
    );
    localStorage.setItem(STORAGE_KEYS.lastClean, JSON.stringify(envelope(new Date().toISOString())));
  },

  createId(prefix: string): string {
    return `${prefix}_${crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
  },
};
