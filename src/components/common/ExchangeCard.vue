<template>
  <article class="exchange-card">
    <header>
      <span class="status-pill" :class="statusToneClass(exchange.status)">
        {{ formatExchangeStatus(exchange.status) }}
      </span>
      <small>{{ formatDate(exchange.updated_at) }}</small>
    </header>
    <div class="exchange-card__items">
      <div>
        <span>拿出</span>
        <strong>{{ fromItem?.title ?? '未知物品' }}</strong>
      </div>
      <div>
        <span>换取</span>
        <strong>{{ toItem?.title ?? '未知物品' }}</strong>
      </div>
    </div>
    <p>{{ exchange.message || formatStatusMessage(exchange.status) }}</p>
    <FulfillmentPanel
      v-if="fulfillment"
      :exchange="exchange"
      :fulfillment="fulfillment"
      :users="users"
      :submitting="confirming"
      @confirm="$emit('confirm', $event)"
    />
    <footer>
      <span v-if="fromUser && toUser">{{ fromUser.nickname }} → {{ toUser.nickname }}</span>
      <div v-if="exchange.status === ExchangeStatus.PENDING && isReceiver" class="exchange-card__actions">
        <button type="button" @click="$emit('accept', exchange.id)">
          同意
        </button>
        <button type="button" @click="$emit('reject', exchange.id)">
          拒绝
        </button>
      </div>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import FulfillmentPanel from '@/components/common/FulfillmentPanel.vue';
import { ExchangeStatus } from '@/constants/exchange';
import type { Exchange } from '@/models/exchange';
import type { ExchangeFulfillment } from '@/models/fulfillment';
import type { Item } from '@/models/item';
import type { User } from '@/models/user';
import { useAuthStore } from '@/stores/authStore';
import { formatDate, formatExchangeStatus, formatStatusMessage, statusToneClass } from '@/utils/formatters';

const props = withDefaults(
  defineProps<{
    exchange: Exchange;
    items: Item[];
    users: User[];
    fulfillment?: ExchangeFulfillment | null;
    confirming?: boolean;
  }>(),
  { fulfillment: null, confirming: false },
);

defineEmits<{
  accept: [id: string];
  reject: [id: string];
  confirm: [id: string];
}>();

const authStore = useAuthStore();
const fromItem = computed(() => props.items.find((item) => item.id === props.exchange.from_item_id));
const toItem = computed(() => props.items.find((item) => item.id === props.exchange.to_item_id));
const fromUser = computed(() => props.users.find((user) => user.id === props.exchange.from_user_id));
const toUser = computed(() => props.users.find((user) => user.id === props.exchange.to_user_id));
const isReceiver = computed(() => authStore.currentUser?.id === props.exchange.to_user_id);
</script>
