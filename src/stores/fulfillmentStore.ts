import { defineStore } from 'pinia';

import { fulfillmentApi } from '@/api/fulfillmentApi';
import { FULFILLMENT_MESSAGES } from '@/constants/messages';
import type { Exchange } from '@/models/exchange';
import type { ExchangeFulfillment } from '@/models/fulfillment';
import { message } from '@/utils/message';

export const useFulfillmentStore = defineStore('fulfillments', {
  state: () => ({
    fulfillments: [] as ExchangeFulfillment[],
    confirmingExchangeId: '' as string,
    loading: false,
  }),
  getters: {
    byExchange: (state) => (exchangeId: string) =>
      state.fulfillments.find((item) => item.exchange_id === exchangeId),
  },
  actions: {
    async hydrate() {
      this.loading = true;
      try {
        this.fulfillments = await fulfillmentApi.list();
      } finally {
        this.loading = false;
      }
    },
    async ensureForExchange(exchange: Exchange) {
      const fulfillment = await fulfillmentApi.ensureForExchange(exchange);
      this.fulfillments = await fulfillmentApi.list();
      return fulfillment;
    },
    /** 确认履约：重复确认与完成重试都由 API 层幂等收口，这里只负责刷新与提示 */
    async confirm(exchangeId: string, userId: string) {
      if (this.confirmingExchangeId === exchangeId) return null;
      this.confirmingExchangeId = exchangeId;
      try {
        const result = await fulfillmentApi.confirm(exchangeId, userId);
        this.fulfillments = await fulfillmentApi.list();
        if (result.completed) {
          message(FULFILLMENT_MESSAGES.completed, 'success');
        } else if (result.alreadyConfirmed) {
          message(FULFILLMENT_MESSAGES.confirmDuplicate);
        } else {
          message(FULFILLMENT_MESSAGES.confirmSuccess, 'success');
        }
        return result;
      } finally {
        this.confirmingExchangeId = '';
      }
    },
  },
});
