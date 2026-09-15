<template>
  <section class="page exchanges-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">交换管理</p>
        <h1>让每一次交换都有状态</h1>
      </div>
    </div>

    <div class="stats-row">
      <span>全部 {{ stats.total }}</span>
      <span>待确认 {{ stats.pending }}</span>
      <span>已同意 {{ stats.accepted }}</span>
      <span>已完成 {{ stats.completed }}</span>
    </div>

    <div class="segmented">
      <button :class="{ active: tab === 'sent' }" type="button" @click="tab = 'sent'">我发起的</button>
      <button :class="{ active: tab === 'received' }" type="button" @click="tab = 'received'">我收到的</button>
      <select v-model="exchangeStore.statusFilter">
        <option value="all">全部状态</option>
        <option v-for="option in EXCHANGE_STATUS_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <div v-if="visibleExchanges.length" class="exchange-list">
      <ExchangeCard
        v-for="exchange in visibleExchanges"
        :key="exchange.id"
        :exchange="exchange"
        :items="itemStore.items"
        :users="authStore.users"
        :fulfillment="fulfillmentStore.byExchange(exchange.id)"
        :confirming="fulfillmentStore.confirmingExchangeId === exchange.id"
        @accept="acceptExchange"
        @reject="exchangeStore.reject"
        @confirm="confirmFulfillment"
      />
    </div>
    <EmptyState
      v-else
      title="暂无交换请求"
      :description="PAGE_MESSAGES.exchangeEmpty"
      mark="换"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import EmptyState from '@/components/common/EmptyState.vue';
import ExchangeCard from '@/components/common/ExchangeCard.vue';
import { EXCHANGE_STATUS_OPTIONS, ExchangeStatus } from '@/constants/exchange';
import { PAGE_MESSAGES } from '@/constants/messages';
import { useExchangeStats } from '@/hooks/useExchangeStats';
import { useAuthStore } from '@/stores/authStore';
import { useExchangeStore } from '@/stores/exchangeStore';
import { useFulfillmentStore } from '@/stores/fulfillmentStore';
import { useItemStore } from '@/stores/itemStore';

const authStore = useAuthStore();
const itemStore = useItemStore();
const exchangeStore = useExchangeStore();
const fulfillmentStore = useFulfillmentStore();
const tab = ref<'sent' | 'received'>('sent');

const mine = computed(() => {
  if (!authStore.currentUser) return [];
  const list = tab.value === 'sent' ? exchangeStore.sent(authStore.currentUser.id) : exchangeStore.received(authStore.currentUser.id);
  return exchangeStore.statusFilter === 'all'
    ? list
    : list.filter((item) => item.status === exchangeStore.statusFilter);
});
const visibleExchanges = computed(() => mine.value);
const stats = useExchangeStats(() => exchangeStore.exchanges);

const acceptExchange = async (id: string) => {
  await exchangeStore.accept(id);
  await fulfillmentStore.hydrate();
};

const confirmFulfillment = async (id: string) => {
  if (!authStore.currentUser) return;
  const result = await fulfillmentStore.confirm(id, authStore.currentUser.id);
  if (result?.completed) {
    // 履约收口后交换状态与两张物品状态都已变更，同步刷新对应 store
    await Promise.all([exchangeStore.hydrate(), itemStore.hydrate()]);
  }
};

onMounted(async () => {
  // 刷新后回读各自确认结果；历史已同意但缺履约单的交换在这里自愈补建
  await fulfillmentStore.hydrate();
  const missing = exchangeStore.exchanges.filter(
    (exchange) =>
      exchange.status === ExchangeStatus.ACCEPTED && !fulfillmentStore.byExchange(exchange.id),
  );
  for (const exchange of missing) {
    await fulfillmentStore.ensureForExchange(exchange);
  }
});
</script>
