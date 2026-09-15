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
   * 多键原子写入：任一 key 失败时按快照回滚已写入的 key，
   * 保证「确认记录 + 交换状态 + 物品状态」这类组合写入不会只落一半。
   */
  async setMany(entries: Array<{ key: string; payload: unknown }>): Promise<void> {
    const snapshots = await Promise.all(
      entries.map(async (entry) => ({
        key: entry.key,
        previous: await this.get<unknown>(entry.key, null),
      })),
    );
    const written: string[] = [];
    try {
      for (const entry of entries) {
        // 先登记再写入：单 key 写了一半失败（localStorage 已写、IndexedDB 未写）时也能回滚
        written.push(entry.key);
        await this.set(entry.key, entry.payload);
      }
    } catch (error) {
      for (const key of [...written].reverse()) {
        const snapshot = snapshots.find((item) => item.key === key);
        try {
          if (snapshot?.previous === null || snapshot?.previous === undefined) {
            await this.remove(key);
          } else {
            await this.set(key, snapshot.previous);
          }
        } catch (rollbackError) {
          console.error(LOG_MESSAGES.storageRollbackFailed, rollbackError);
        }
      }
      throw error;
    }
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
