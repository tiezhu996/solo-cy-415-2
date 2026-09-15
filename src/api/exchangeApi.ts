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
    const exchanges = await this.list();
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
    await storage.set(STORAGE_KEYS.exchanges, [nextExchange, ...exchanges]);
    return nextExchange;
  },

  async transition(id: string, status: ExchangeStatus): Promise<Exchange> {
    const exchanges = await this.list();
    const current = exchanges.find((item) => item.id === id);
    if (!current) throw new Error('交换请求不存在');
    if (!EXCHANGE_ACTION_FLOW[current.status].includes(status)) {
      throw new Error('当前状态不允许该操作');
    }
    if (status === ExchangeStatus.COMPLETED) {
      // 完成只能由履约模块在双方各自确认后收口，禁止单边直接完成
      throw new Error(FULFILLMENT_MESSAGES.directCompleteForbidden);
    }
    const nextExchange: Exchange = { ...current, status, updated_at: new Date().toISOString() };
    await storage.set(
      STORAGE_KEYS.exchanges,
      exchanges.map((item) => (item.id === id ? nextExchange : item)),
    );
    if (status === ExchangeStatus.ACCEPTED) {
      try {
        // 同意后生成唯一履约码；履约单落库失败时回滚同意动作，避免半成功状态
        await fulfillmentApi.ensureForExchange(nextExchange);
      } catch (error) {
        await storage.set(STORAGE_KEYS.exchanges, exchanges);
        throw error;
      }
    }
    return nextExchange;
  },
};
