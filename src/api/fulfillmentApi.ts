import { ExchangeStatus } from '@/constants/exchange';
import {
  FULFILLMENT_CODE_ALPHABET,
  FULFILLMENT_CODE_PREFIX,
  FulfillmentStatus,
} from '@/constants/fulfillment';
import { ItemStatus } from '@/constants/item';
import { FULFILLMENT_MESSAGES } from '@/constants/messages';
import type { Exchange } from '@/models/exchange';
import type {
  ExchangeFulfillment,
  FulfillmentConfirmation,
  FulfillmentConfirmResult,
  FulfillmentRole,
} from '@/models/fulfillment';
import type { Item } from '@/models/item';
import { storage, STORAGE_KEYS } from '@/utils/storage';
import { validateFulfillmentConfirm } from '@/utils/validators';

/**
 * 履约确认收口规则（对应验收口径）：
 * 1. 同一方重复确认、双方几乎同时确认、完成后的重试，都只收口一次；
 * 2. 双方确认记录与交换状态、两张物品状态一起落下，任一写入失败整体回滚；
 * 3. 确认记录持久化在 fulfillments 存储中，刷新后按 exchange_id 回读。
 */

const confirmLocks = new Map<string, Promise<void>>();

/** 同一交换的履约操作串行执行：内存队列管同页并发，Web Locks 管多标签页并发 */
const runExclusive = <T>(exchangeId: string, task: () => Promise<T>): Promise<T> => {
  const previous = confirmLocks.get(exchangeId) ?? Promise.resolve();
  const run: Promise<T> = previous.then(async () => {
    if (typeof navigator !== 'undefined' && navigator.locks) {
      // await 会递归解包 thenable，类型与运行时都收敛为 T
      return await navigator.locks.request(`reswap:fulfillment:${exchangeId}`, () => task());
    }
    return task();
  });
  const tracked = run.then(
    () => {
      if (confirmLocks.get(exchangeId) === tracked) confirmLocks.delete(exchangeId);
    },
    () => {
      if (confirmLocks.get(exchangeId) === tracked) confirmLocks.delete(exchangeId);
    },
  );
  confirmLocks.set(exchangeId, tracked);
  return run;
};

const randomCodeSegment = (length: number) => {
  const values = new Uint32Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(values);
  } else {
    for (let index = 0; index < length; index += 1) {
      values[index] = Math.floor(Math.random() * 2 ** 32);
    }
  }
  return Array.from(
    values,
    (value) => FULFILLMENT_CODE_ALPHABET[value % FULFILLMENT_CODE_ALPHABET.length],
  ).join('');
};

const generateFulfillmentCode = (takenCodes: Set<string>) => {
  let code = '';
  do {
    code = `${FULFILLMENT_CODE_PREFIX}-${randomCodeSegment(4)}-${randomCodeSegment(4)}`;
  } while (takenCodes.has(code));
  return code;
};

const buildFulfillment = (
  exchange: Exchange,
  existing: ExchangeFulfillment[],
): ExchangeFulfillment => {
  const now = new Date().toISOString();
  return {
    id: storage.createId('fulfillment'),
    exchange_id: exchange.id,
    code: generateFulfillmentCode(new Set(existing.map((item) => item.code))),
    status: FulfillmentStatus.CONFIRMING,
    confirmations: [],
    created_at: now,
    updated_at: now,
    completed_at: null,
  };
};

const upsertFulfillment = (list: ExchangeFulfillment[], next: ExchangeFulfillment) => {
  const index = list.findIndex((item) => item.id === next.id);
  if (index === -1) return [next, ...list];
  return list.map((item) => (item.id === next.id ? next : item));
};

export const fulfillmentApi = {
  async list(): Promise<ExchangeFulfillment[]> {
    return storage.get<ExchangeFulfillment[]>(STORAGE_KEYS.fulfillments, []);
  },

  async getByExchange(exchangeId: string): Promise<ExchangeFulfillment | undefined> {
    const fulfillments = await this.list();
    return fulfillments.find((item) => item.exchange_id === exchangeId);
  },

  /** 交换被同意后生成唯一履约码；同一交换重复调用只返回已有履约单 */
  async ensureForExchange(exchange: Exchange): Promise<ExchangeFulfillment> {
    return runExclusive(exchange.id, async () => {
      const fulfillments = await this.list();
      const existing = fulfillments.find((item) => item.exchange_id === exchange.id);
      if (existing) return existing;
      const fulfillment = buildFulfillment(exchange, fulfillments);
      await storage.set(STORAGE_KEYS.fulfillments, [fulfillment, ...fulfillments]);
      return fulfillment;
    });
  },

  async confirm(exchangeId: string, userId: string): Promise<FulfillmentConfirmResult> {
    return runExclusive(exchangeId, async () => {
      const [fulfillments, exchanges, items] = await Promise.all([
        storage.get<ExchangeFulfillment[]>(STORAGE_KEYS.fulfillments, []),
        storage.get<Exchange[]>(STORAGE_KEYS.exchanges, []),
        storage.get<Item[]>(STORAGE_KEYS.items, []),
      ]);
      const exchange = exchanges.find((item) => item.id === exchangeId);
      if (!exchange) throw new Error(FULFILLMENT_MESSAGES.exchangeMissing);
      const current = fulfillments.find((item) => item.exchange_id === exchangeId);

      // 幂等收口：已完成的交换无论重试多少次，都不再变更确认记录与物品状态
      if (exchange.status === ExchangeStatus.COMPLETED || current?.status === FulfillmentStatus.COMPLETED) {
        if (!current) throw new Error(FULFILLMENT_MESSAGES.fulfillmentMissing);
        return { fulfillment: current, exchange, completed: false, alreadyConfirmed: true };
      }

      const invalidMessage = validateFulfillmentConfirm(exchange, userId);
      if (invalidMessage) throw new Error(invalidMessage);

      // 自愈：已同意但履约单缺失（例如同意时写入失败）时补建，履约码仍保持唯一
      const fulfillment = current ?? buildFulfillment(exchange, fulfillments);

      // 同一方重复确认：直接返回当前状态，不产生任何写入
      if (fulfillment.confirmations.some((item) => item.user_id === userId)) {
        return { fulfillment, exchange, completed: false, alreadyConfirmed: true };
      }

      const now = new Date().toISOString();
      const role: FulfillmentRole = userId === exchange.from_user_id ? 'initiator' : 'receiver';
      const confirmation: FulfillmentConfirmation = { user_id: userId, role, confirmed_at: now };
      const nextFulfillment: ExchangeFulfillment = {
        ...fulfillment,
        confirmations: [...fulfillment.confirmations, confirmation],
        updated_at: now,
      };
      const bothConfirmed = [exchange.from_user_id, exchange.to_user_id].every((partyId) =>
        nextFulfillment.confirmations.some((item) => item.user_id === partyId),
      );

      if (!bothConfirmed) {
        await storage.set(STORAGE_KEYS.fulfillments, upsertFulfillment(fulfillments, nextFulfillment));
        return { fulfillment: nextFulfillment, exchange, completed: false, alreadyConfirmed: false };
      }

      // 双方确认记录、交换状态、两张物品状态必须一起落下；任一失败整体回滚
      const fromItem = items.find((item) => item.id === exchange.from_item_id);
      const toItem = items.find((item) => item.id === exchange.to_item_id);
      if (!fromItem || !toItem) throw new Error(FULFILLMENT_MESSAGES.itemMissing);

      const completedFulfillment: ExchangeFulfillment = {
        ...nextFulfillment,
        status: FulfillmentStatus.COMPLETED,
        updated_at: now,
        completed_at: now,
      };
      const nextExchange: Exchange = { ...exchange, status: ExchangeStatus.COMPLETED, updated_at: now };
      const nextItems = items.map((item) =>
        item.id === exchange.from_item_id || item.id === exchange.to_item_id
          ? { ...item, status: ItemStatus.EXCHANGED }
          : item,
      );
      await storage.setMany([
        { key: STORAGE_KEYS.fulfillments, payload: upsertFulfillment(fulfillments, completedFulfillment) },
        {
          key: STORAGE_KEYS.exchanges,
          payload: exchanges.map((item) => (item.id === exchangeId ? nextExchange : item)),
        },
        { key: STORAGE_KEYS.items, payload: nextItems },
      ]);
      return { fulfillment: completedFulfillment, exchange: nextExchange, completed: true, alreadyConfirmed: false };
    });
  },
};
