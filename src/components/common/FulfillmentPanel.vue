<template>
  <section class="fulfillment-panel">
    <div class="fulfillment-panel__head">
      <span class="status-pill" :class="statusToneClass(fulfillment.status)">
        {{ formatFulfillmentStatus(fulfillment.status) }}
      </span>
      <div class="fulfillment-panel__code">
        <span>{{ FULFILLMENT_MESSAGES.codeLabel }}</span>
        <strong>{{ fulfillment.code }}</strong>
      </div>
    </div>

    <ul class="fulfillment-panel__confirms">
      <li v-for="party in parties" :key="party.userId" :class="{ confirmed: Boolean(party.confirmation) }">
        <span>{{ party.label }} · {{ party.nickname }}</span>
        <strong v-if="party.confirmation">已确认 {{ formatDate(party.confirmation.confirmed_at) }}</strong>
        <em v-else>待确认</em>
      </li>
    </ul>

    <div class="fulfillment-panel__actions">
      <button
        v-if="canConfirm || canRetryClose"
        class="primary-button"
        type="button"
        :disabled="submitting"
        @click="$emit('confirm', exchange.id)"
      >
        {{ submitting ? '确认中…' : canRetryClose ? FULFILLMENT_MESSAGES.retryClose : '确认履约' }}
      </button>
      <span v-else-if="isBlocked" class="fulfillment-panel__hint fulfillment-panel__hint--blocked">
        {{ FULFILLMENT_MESSAGES.blocked }}
      </span>
      <span v-else-if="waitingForOther" class="fulfillment-panel__hint">
        {{ FULFILLMENT_MESSAGES.waitingOther }}
      </span>
      <span v-else-if="isCompleted" class="fulfillment-panel__hint">
        {{ FULFILLMENT_MESSAGES.completed }}
      </span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { ExchangeStatus } from '@/constants/exchange';
import { FulfillmentStatus } from '@/constants/fulfillment';
import { FULFILLMENT_MESSAGES } from '@/constants/messages';
import type { Exchange } from '@/models/exchange';
import type { ExchangeFulfillment } from '@/models/fulfillment';
import type { User } from '@/models/user';
import { useAuthStore } from '@/stores/authStore';
import { formatDate, formatFulfillmentStatus, statusToneClass } from '@/utils/formatters';

const props = withDefaults(
  defineProps<{
    exchange: Exchange;
    fulfillment: ExchangeFulfillment;
    users: User[];
    submitting?: boolean;
  }>(),
  { submitting: false },
);

defineEmits<{
  confirm: [id: string];
}>();

const authStore = useAuthStore();

const parties = computed(() =>
  (
    [
      { userId: props.exchange.from_user_id, label: '发起方' },
      { userId: props.exchange.to_user_id, label: '接收方' },
    ] as const
  ).map((party) => ({
    ...party,
    nickname: props.users.find((user) => user.id === party.userId)?.nickname ?? '未知用户',
    confirmation: props.fulfillment.confirmations.find((item) => item.user_id === party.userId),
  })),
);

const myConfirmation = computed(() =>
  props.fulfillment.confirmations.find((item) => item.user_id === authStore.currentUser?.id),
);

const isParty = computed(
  () =>
    authStore.currentUser?.id === props.exchange.from_user_id ||
    authStore.currentUser?.id === props.exchange.to_user_id,
);

const isCompleted = computed(() => props.fulfillment.status === FulfillmentStatus.COMPLETED);
const isBlocked = computed(() => props.fulfillment.status === FulfillmentStatus.BLOCKED);
const isClosing = computed(() => props.fulfillment.status === FulfillmentStatus.CLOSING);

const canConfirm = computed(
  () =>
    props.exchange.status === ExchangeStatus.ACCEPTED &&
    isParty.value &&
    !myConfirmation.value &&
    !isBlocked.value &&
    !isClosing.value,
);

const bothConfirmed = computed(() => parties.value.every((party) => Boolean(party.confirmation)));

/** 收口执行中或认领被释放（双方确认已在案）：双方任一方都可重试收口 */
const canRetryClose = computed(
  () =>
    props.exchange.status === ExchangeStatus.ACCEPTED &&
    isParty.value &&
    (isClosing.value || (bothConfirmed.value && props.fulfillment.status === FulfillmentStatus.CONFIRMING)),
);

const waitingForOther = computed(
  () =>
    props.exchange.status === ExchangeStatus.ACCEPTED &&
    Boolean(myConfirmation.value) &&
    !isClosing.value &&
    !bothConfirmed.value,
);
</script>
