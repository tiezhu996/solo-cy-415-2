import { EXCHANGE_ACTION_FLOW, ExchangeStatus } from '@/constants/exchange';
import { ItemStatus } from '@/constants/item';
import { FULFILLMENT_MESSAGES } from '@/constants/messages';
import type { Exchange, ExchangeDraft } from '@/models/exchange';

import { fulfillmentApi } from './fulfillmentApi';
import { itemApi } from './itemApi';
import { storage, STORAGE_KEYS } from '@/utils/storage';

const seedExchanges: Exchange[] = [
  {
    id: 'exchange_seed',
    from_user_id: 'user_me',
    to_user_id: 'user_lin',
    from_item_id: 'item_chair',
    to_item_id: 'item_camera',
    status: ExchangeStatus.PENDING,
    message: '露营椅换拍立得，可以同城当面交换。',
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
];

export const exchangeApi = {
  async list(): Promise<Exchange[]> {
    const exchanges = await storage.get<Exchange[]>(STORAGE_KEYS.exchanges, []);
    if (exchanges.length) return exchanges;
    await storage.set(STORAGE_KEYS.exchanges, seedExchanges);
    return seedExchanges;
  },

  async create(draft: ExchangeDraft): Promise<Exchange> {
    await this.list();
    const targetItem = await itemApi.detail(draft.to_item_id);
    if (!targetItem || targetItem.status !== ItemStatus.AVAILABLE) {
      throw new Error('目标物品当前不可交换');
    }
    const nextExchange: Exchange = {
      ...draft,
      id: storage.createId('exchange'),
      status: draft.status ?? ExchangeStatus.PENDING,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    // 键级串行写：并发发起多条请求时各自追加到最新列表，互不覆盖
    await storage.mutate<Exchange[]>(STORAGE_KEYS.exchanges, [], (exchanges) => [
      nextExchange,
      ...exchanges,
    ]);
    return nextExchange;
  },

  async transition(id: string, status: ExchangeStatus): Promise<Exchange> {
    await this.list();
    let previousExchange: Exchange | undefined;
    let nextExchange: Exchange | undefined;
    // 锁内基于最新列表校验并变更：多个请求同时被处理时各自落各自的状态，互不覆盖
    await storage.mutate<Exchange[]>(STORAGE_KEYS.exchanges, [], (exchanges) => {
      const current = exchanges.find((item) => item.id === id);
      if (!current) throw new Error('交换请求不存在');
      if (!EXCHANGE_ACTION_FLOW[current.status].includes(status)) {
        throw new Error('当前状态不允许该操作');
      }
      if (status === ExchangeStatus.COMPLETED) {
        // 完成只能由履约模块在双方各自确认后收口，禁止单边直接完成
        throw new Error(FULFILLMENT_MESSAGES.directCompleteForbidden);
      }
      previousExchange = current;
      const updated: Exchange = { ...current, status, updated_at: new Date().toISOString() };
      nextExchange = updated;
      return exchanges.map((item) => (item.id === id ? updated : item));
    });
    if (!nextExchange) throw new Error('交换请求不存在');
    const committedExchange: Exchange = nextExchange;

    if (status === ExchangeStatus.ACCEPTED) {
      try {
        // 同意后生成唯一履约码
        await fulfillmentApi.ensureForExchange(committedExchange);
      } catch (error) {
        // 履约单落库失败：只把本请求回滚为待确认，其他请求已成功的同意与履约单保持不变
        const fallback = previousExchange;
        await storage.mutate<Exchange[]>(STORAGE_KEYS.exchanges, [], (exchanges) =>
          exchanges.map((item) => (item.id === id && fallback ? fallback : item)),
        );
        throw error;
      }
    }
    return committedExchange;
  },
};
