import type { ItemDraft } from '@/models/item';
import type { UserDraft } from '@/models/user';

import { ExchangeStatus } from '@/constants/exchange';
import { FORM_MESSAGES, FULFILLMENT_MESSAGES } from '@/constants/messages';
import type { Exchange } from '@/models/exchange';

export const validateItemDraft = (draft: Partial<ItemDraft>) => {
  if (!draft.title?.trim()) return FORM_MESSAGES.requiredTitle;
  if (!draft.description?.trim()) return FORM_MESSAGES.requiredDescription;
  return '';
};

export const validateUserDraft = (draft: Partial<UserDraft>) => {
  if (!draft.nickname?.trim()) return '昵称不能为空';
  if (!draft.phone?.trim()) return FORM_MESSAGES.requiredPhone;
  return '';
};

/** 履约确认前置校验：只有「已同意」的交换且本人是交换双方之一才允许确认 */
export const validateFulfillmentConfirm = (exchange: Exchange, userId: string) => {
  if (exchange.status !== ExchangeStatus.ACCEPTED) return FULFILLMENT_MESSAGES.notReady;
  if (userId !== exchange.from_user_id && userId !== exchange.to_user_id) {
    return FULFILLMENT_MESSAGES.notParty;
  }
  return '';
};
