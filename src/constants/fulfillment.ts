export enum FulfillmentStatus {
  CONFIRMING = 'confirming',
  COMPLETED = 'completed',
}

export const FULFILLMENT_STATUS_OPTIONS = [
  { label: '履约确认中', value: FulfillmentStatus.CONFIRMING },
  { label: '履约完成', value: FulfillmentStatus.COMPLETED },
];

/** 履约码字符集：去掉易混淆的 0/O/1/I */
export const FULFILLMENT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const FULFILLMENT_CODE_PREFIX = 'RS';

export const FULFILLMENT_STORAGE_HINTS = {
  statusKey: 'reswap:fulfillments',
  statusTouchedBy: [
    'models/fulfillment.ts',
    'api/fulfillmentApi.ts',
    'stores/fulfillmentStore.ts',
    'components/common/FulfillmentPanel.vue',
  ],
};
