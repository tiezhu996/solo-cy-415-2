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
 * 3. 确认记录持久化在 fulfillments 存储中，刷新后按 exchange_id 回读；
 * 4. 多个交换并发同意/确认时，经 storage 键级串行锁各自合并到最新列表，互不覆盖；
 * 5. 物品归属冲突：同一物品被多条已同意交换引用时，完成确认先认领物品（closing），
 *    只有认领成功的一条能写回物品；未获得归属的交换标记 blocked 且不留完成确认记录；
 *    认领先于收口持久化，收口写入失败时认领方保持待收口、两条交换都不进入完成态；
 * 6. 认领释放：认领方失去完成条件（物品下架或交换不再已同意）时释放认领，
 *    双方确认与履约码原样保留；等待中的受阻交换在归属空出后解除受阻、重新具备
 *    完成资格，完成前仍需双方各自确认；释放与重试并发时经键级串行只产生一个有效归属。
 */

const FULFILLMENT_TX_KEYS = [STORAGE_KEYS.fulfillments, STORAGE_KEYS.exchanges, STORAGE_KEYS.items];

type ClaimOutcome =
  | { kind: 'done'; fulfillment: ExchangeFulfillment; exchange: Exchange }
  | { kind: 'duplicate'; fulfillment: ExchangeFulfillment; exchange: Exchange }
  | { kind: 'partial'; fulfillment: ExchangeFulfillment; exchange: Exchange }
  | { kind: 'blocked'; fulfillment: ExchangeFulfillment; exchange: Exchange }
  | { kind: 'finalize'; fulfillment: ExchangeFulfillment; exchange: Exchange };

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
    blocked_at: null,
  };
};

const upsertFulfillment = (list: ExchangeFulfillment[], next: ExchangeFulfillment) => {
  const index = list.findIndex((item) => item.id === next.id);
  if (index === -1) return [next, ...list];
  return list.map((item) => (item.id === next.id ? next : item));
};

/**
 * 物品归属检查：物品必须仍存在且可交换，且没有被其他履约单认领（closing）或完成（completed）。
 * 返回 'missing'（物品缺失）、'conflict'（归属冲突）或 ''（可认领）。
 */
const findItemConflict = (
  exchange: Exchange,
  fulfillments: ExchangeFulfillment[],
  exchanges: Exchange[],
  items: Item[],
  ownFulfillmentId: string,
): 'missing' | 'conflict' | '' => {
  const myItemIds = [exchange.from_item_id, exchange.to_item_id];
  const myItems = myItemIds.map((id) => items.find((item) => item.id === id));
  if (myItems.some((item) => item === undefined)) return 'missing';
  if (myItems.some((item) => item && item.status !== ItemStatus.AVAILABLE)) return 'conflict';
  const claimedByOther = fulfillments.some((fulfillment) => {
    if (fulfillment.id === ownFulfillmentId) return false;
    if (
      fulfillment.status !== FulfillmentStatus.CLOSING &&
      fulfillment.status !== FulfillmentStatus.COMPLETED
    ) {
      return false;
    }
    const claimExchange = exchanges.find((item) => item.id === fulfillment.exchange_id);
    if (!claimExchange) return false;
    return [claimExchange.from_item_id, claimExchange.to_item_id].some((id) =>
      myItemIds.includes(id),
    );
  });
  return claimedByOther ? 'conflict' : '';
};

/** 认领方是否已失去完成条件：交换不再已同意，或任一物品已不可交换（下架/被换走） */
const hasLostCompletionCondition = (exchange: Exchange | undefined, items: Item[]) => {
  if (!exchange || exchange.status !== ExchangeStatus.ACCEPTED) return true;
  return [exchange.from_item_id, exchange.to_item_id].some((id) => {
    const item = items.find((entry) => entry.id === id);
    return !item || item.status !== ItemStatus.AVAILABLE;
  });
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
    let ensured: ExchangeFulfillment | undefined;
    // 键级串行读改写：多个交换同时获同意时，各自履约单合并进最新列表，互不覆盖
    await storage.mutate<ExchangeFulfillment[]>(STORAGE_KEYS.fulfillments, [], (fulfillments) => {
      const existing = fulfillments.find((item) => item.exchange_id === exchange.id);
      if (existing) {
        ensured = existing;
        return fulfillments; // 引用不变，mutate 跳过写入
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
  async releaseStaleClaims(): Promise<{ released: string[]; unblocked: string[] }> {
    return storage.atomic(FULFILLMENT_TX_KEYS, async (tx) => {
      const [fulfillments, exchanges, items] = await Promise.all([
        tx.get<ExchangeFulfillment[]>(STORAGE_KEYS.fulfillments, []),
        tx.get<Exchange[]>(STORAGE_KEYS.exchanges, []),
        tx.get<Item[]>(STORAGE_KEYS.items, []),
      ]);
      const now = new Date().toISOString();
      let next = fulfillments;
      const released: string[] = [];
      const unblocked: string[] = [];

      // 1) 释放：认领中的履约单失去完成条件 → 回到确认中（确认记录与履约码不动）
      for (const fulfillment of fulfillments) {
        if (fulfillment.status !== FulfillmentStatus.CLOSING) continue;
        const exchange = exchanges.find((item) => item.id === fulfillment.exchange_id);
        if (!hasLostCompletionCondition(exchange, items)) continue;
        next = upsertFulfillment(next, {
          ...fulfillment,
          status: FulfillmentStatus.CONFIRMING,
          updated_at: now,
        });
        released.push(fulfillment.exchange_id);
      }

      // 2) 解除受阻：物品已可用且没有其他认领/完成占用 → 回到确认中，重新具备完成资格
      for (const fulfillment of next) {
        if (fulfillment.status !== FulfillmentStatus.BLOCKED) continue;
        const exchange = exchanges.find((item) => item.id === fulfillment.exchange_id);
        if (!exchange || exchange.status !== ExchangeStatus.ACCEPTED) continue;
        if (findItemConflict(exchange, next, exchanges, items, fulfillment.id)) continue;
        next = upsertFulfillment(next, {
          ...fulfillment,
          status: FulfillmentStatus.CONFIRMING,
          blocked_at: null,
          updated_at: now,
        });
        unblocked.push(fulfillment.exchange_id);
      }

      if (released.length || unblocked.length) {
        tx.set(STORAGE_KEYS.fulfillments, next);
      }
      return { released, unblocked };
    });
  },

  async confirm(exchangeId: string, userId: string): Promise<FulfillmentConfirmResult> {
    // 先释放已失去完成条件的认领，再处理本次确认（释放与确认经同一把键级锁串行）
    await this.releaseStaleClaims();

    // 第一阶段：冲突检查 + 记录确认 + 认领物品（closing），或未获归属时标记受阻（blocked）
    const claim = await storage.atomic(FULFILLMENT_TX_KEYS, async (tx): Promise<ClaimOutcome> => {
      const [fulfillmentsBefore, exchanges, items] = await Promise.all([
        tx.get<ExchangeFulfillment[]>(STORAGE_KEYS.fulfillments, []),
        tx.get<Exchange[]>(STORAGE_KEYS.exchanges, []),
        tx.get<Item[]>(STORAGE_KEYS.items, []),
      ]);
      let fulfillments = fulfillmentsBefore;
      const exchange = exchanges.find((item) => item.id === exchangeId);
      if (!exchange) throw new Error(FULFILLMENT_MESSAGES.exchangeMissing);
      let current = fulfillments.find((item) => item.exchange_id === exchangeId);
      const now = new Date().toISOString();

      // 幂等收口：已完成的交换无论重试多少次都不再变更确认记录与物品状态
      if (
        exchange.status === ExchangeStatus.COMPLETED ||
        current?.status === FulfillmentStatus.COMPLETED
      ) {
        if (!current) throw new Error(FULFILLMENT_MESSAGES.fulfillmentMissing);
        return { kind: 'done', fulfillment: current, exchange };
      }

      // 已受阻：重新评估归属是否仍被占用；归属已空出则解除受阻（确认记录与履约码保留）
      if (current?.status === FulfillmentStatus.BLOCKED) {
        const stillBlocked =
          exchange.status !== ExchangeStatus.ACCEPTED ||
          findItemConflict(exchange, fulfillments, exchanges, items, current.id) !== '';
        if (stillBlocked) {
          return { kind: 'blocked', fulfillment: current, exchange };
        }
        const unblockedFulfillment: ExchangeFulfillment = {
          ...current,
          status: FulfillmentStatus.CONFIRMING,
          blocked_at: null,
          updated_at: now,
        };
        fulfillments = upsertFulfillment(fulfillments, unblockedFulfillment);
        tx.set(STORAGE_KEYS.fulfillments, fulfillments);
        current = unblockedFulfillment;
      }

      const invalidMessage = validateFulfillmentConfirm(exchange, userId);
      if (invalidMessage) throw new Error(invalidMessage);

      // 自愈：已同意但履约单缺失（例如同意时写入失败）时补建，履约码仍保持唯一
      const fulfillment = current ?? buildFulfillment(exchange, fulfillments);

      // 已认领（双方确认已在案）：直接进入收口阶段
      if (fulfillment.status === FulfillmentStatus.CLOSING) {
        return { kind: 'finalize', fulfillment, exchange };
      }

      // 双方确认已在案（认领被释放后重试）：不新增确认记录，直接重新认领
      const bothPartiesConfirmed = [exchange.from_user_id, exchange.to_user_id].every((partyId) =>
        fulfillment.confirmations.some((item) => item.user_id === partyId),
      );
      if (bothPartiesConfirmed) {
        const conflict = findItemConflict(exchange, fulfillments, exchanges, items, fulfillment.id);
        if (conflict === 'missing') throw new Error(FULFILLMENT_MESSAGES.itemMissing);
        if (conflict === 'conflict') {
          const blockedFulfillment: ExchangeFulfillment = {
            ...fulfillment,
            status: FulfillmentStatus.BLOCKED,
            blocked_at: now,
            updated_at: now,
          };
          tx.set(STORAGE_KEYS.fulfillments, upsertFulfillment(fulfillments, blockedFulfillment));
          return { kind: 'blocked', fulfillment: blockedFulfillment, exchange };
        }
        const closingFulfillment: ExchangeFulfillment = {
          ...fulfillment,
          status: FulfillmentStatus.CLOSING,
          updated_at: now,
        };
        tx.set(STORAGE_KEYS.fulfillments, upsertFulfillment(fulfillments, closingFulfillment));
        return { kind: 'finalize', fulfillment: closingFulfillment, exchange };
      }

      // 同一方重复确认：直接返回当前状态，不产生任何写入
      if (fulfillment.confirmations.some((item) => item.user_id === userId)) {
        return { kind: 'duplicate', fulfillment, exchange };
      }

      const role: FulfillmentRole = userId === exchange.from_user_id ? 'initiator' : 'receiver';
      const confirmation: FulfillmentConfirmation = { user_id: userId, role, confirmed_at: now };
      const nextConfirmations = [...fulfillment.confirmations, confirmation];
      const bothConfirmed = [exchange.from_user_id, exchange.to_user_id].every((partyId) =>
        nextConfirmations.some((item) => item.user_id === partyId),
      );

      if (!bothConfirmed) {
        const nextFulfillment: ExchangeFulfillment = {
          ...fulfillment,
          confirmations: nextConfirmations,
          updated_at: now,
        };
        tx.set(STORAGE_KEYS.fulfillments, upsertFulfillment(fulfillments, nextFulfillment));
        return { kind: 'partial', fulfillment: nextFulfillment, exchange };
      }

      // 完成确认前先检查物品归属：只有一条交换能认领同一物品
      const conflict = findItemConflict(exchange, fulfillments, exchanges, items, fulfillment.id);
      if (conflict === 'missing') throw new Error(FULFILLMENT_MESSAGES.itemMissing);
      if (conflict === 'conflict') {
        // 未获得归属：只落受阻标记，不记录本次确认（不留半条确认记录）
        const blockedFulfillment: ExchangeFulfillment = {
          ...fulfillment,
          status: FulfillmentStatus.BLOCKED,
          blocked_at: now,
          updated_at: now,
        };
        tx.set(STORAGE_KEYS.fulfillments, upsertFulfillment(fulfillments, blockedFulfillment));
        return { kind: 'blocked', fulfillment: blockedFulfillment, exchange };
      }

      // 获得归属：记录双方确认并认领物品；认领独立于收口写入持久化，收口失败可安全重试
      const closingFulfillment: ExchangeFulfillment = {
        ...fulfillment,
        confirmations: nextConfirmations,
        status: FulfillmentStatus.CLOSING,
        updated_at: now,
      };
      tx.set(STORAGE_KEYS.fulfillments, upsertFulfillment(fulfillments, closingFulfillment));
      return { kind: 'finalize', fulfillment: closingFulfillment, exchange };
    });

    if (claim.kind === 'blocked') throw new Error(FULFILLMENT_MESSAGES.itemConflict);
    if (claim.kind === 'done' || claim.kind === 'duplicate') {
      return {
        fulfillment: claim.fulfillment,
        exchange: claim.exchange,
        completed: false,
        alreadyConfirmed: true,
      };
    }
    if (claim.kind === 'partial') {
      return {
        fulfillment: claim.fulfillment,
        exchange: claim.exchange,
        completed: false,
        alreadyConfirmed: false,
      };
    }

    // 第二阶段：收口。认领（closing）已持久化，收口写入失败时认领仍保留
    return this.finalizeClaim(claim.fulfillment.exchange_id);
  },

  /** 收口已认领的履约：交换完成 + 两张物品写回，整体原子提交 */
  async finalizeClaim(exchangeId: string): Promise<FulfillmentConfirmResult> {
    return storage.atomic(FULFILLMENT_TX_KEYS, async (tx) => {
      const [fulfillments, exchanges, items] = await Promise.all([
        tx.get<ExchangeFulfillment[]>(STORAGE_KEYS.fulfillments, []),
        tx.get<Exchange[]>(STORAGE_KEYS.exchanges, []),
        tx.get<Item[]>(STORAGE_KEYS.items, []),
      ]);
      const exchange = exchanges.find((item) => item.id === exchangeId);
      if (!exchange) throw new Error(FULFILLMENT_MESSAGES.exchangeMissing);
      const current = fulfillments.find((item) => item.exchange_id === exchangeId);
      if (!current) throw new Error(FULFILLMENT_MESSAGES.fulfillmentMissing);

      // 并发的另一次收口已完成：幂等返回
      if (
        exchange.status === ExchangeStatus.COMPLETED ||
        current.status === FulfillmentStatus.COMPLETED
      ) {
        return { fulfillment: current, exchange, completed: false, alreadyConfirmed: true };
      }
      if (current.status !== FulfillmentStatus.CLOSING) {
        throw new Error(FULFILLMENT_MESSAGES.notReady);
      }

      // 收口前复核归属：物品被占用则保持认领，等待重试
      const conflict = findItemConflict(exchange, fulfillments, exchanges, items, current.id);
      if (conflict === 'missing') throw new Error(FULFILLMENT_MESSAGES.itemMissing);
      if (conflict === 'conflict') throw new Error(FULFILLMENT_MESSAGES.itemConflict);

      const now = new Date().toISOString();
      const completedFulfillment: ExchangeFulfillment = {
        ...current,
        status: FulfillmentStatus.COMPLETED,
        updated_at: now,
        completed_at: now,
      };
      const nextExchange: Exchange = {
        ...exchange,
        status: ExchangeStatus.COMPLETED,
        updated_at: now,
      };
      const nextItems = items.map((item) =>
        item.id === exchange.from_item_id || item.id === exchange.to_item_id
          ? { ...item, status: ItemStatus.EXCHANGED }
          : item,
      );
      tx.set(STORAGE_KEYS.fulfillments, upsertFulfillment(fulfillments, completedFulfillment));
      tx.set(
        STORAGE_KEYS.exchanges,
        exchanges.map((item) => (item.id === exchangeId ? nextExchange : item)),
      );
      tx.set(STORAGE_KEYS.items, nextItems);
      return {
        fulfillment: completedFulfillment,
        exchange: nextExchange,
        completed: true,
        alreadyConfirmed: false,
      };
    });
  },
};
