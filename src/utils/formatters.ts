import dayjs from 'dayjs';

import { ExchangeStatus } from '@/constants/exchange';
import { FulfillmentStatus } from '@/constants/fulfillment';
import { ItemCondition, ItemStatus } from '@/constants/item';
import { STATUS_MESSAGE_MAP } from '@/constants/messages';

export const formatDate = (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm');

export const formatItemStatus = (status: ItemStatus) => {
  const map: Record<ItemStatus, string> = {
    [ItemStatus.AVAILABLE]: '可交换',
    [ItemStatus.EXCHANGED]: '已交换',
    [ItemStatus.OFFLINE]: '已下架',
  };
  return map[status];
};

export const formatExchangeStatus = (status: ExchangeStatus) => {
  const map: Record<ExchangeStatus, string> = {
    [ExchangeStatus.PENDING]: '待确认',
    [ExchangeStatus.ACCEPTED]: '已同意',
    [ExchangeStatus.REJECTED]: '已拒绝',
    [ExchangeStatus.COMPLETED]: '已完成',
  };
  return map[status];
};

export const formatFulfillmentStatus = (status: FulfillmentStatus) => {
  const map: Record<FulfillmentStatus, string> = {
    [FulfillmentStatus.CONFIRMING]: '履约确认中',
    [FulfillmentStatus.CLOSING]: '履约收口执行中',
    [FulfillmentStatus.BLOCKED]: '履约受阻',
    [FulfillmentStatus.COMPLETED]: '履约完成',
  };
  return map[status];
};

export const formatCondition = (condition: ItemCondition) => {
  const map: Record<ItemCondition, string> = {
    [ItemCondition.NEW]: '全新',
    [ItemCondition.LIKE_NEW]: '九成新',
    [ItemCondition.GOOD]: '八成新',
    [ItemCondition.WORN]: '战损',
  };
  return map[condition];
};

export const formatCreditLevel = (score: number) => {
  if (score >= 90) return '守约达人';
  if (score >= 75) return '稳定交换';
  if (score >= 60) return '新晋用户';
  return '需谨慎';
};

export const statusToneClass = (status: ItemStatus | ExchangeStatus | FulfillmentStatus) => {
  if (status === ItemStatus.AVAILABLE || status === ExchangeStatus.ACCEPTED) return 'status-good';
  if (
    status === ItemStatus.OFFLINE ||
    status === ExchangeStatus.REJECTED ||
    status === FulfillmentStatus.BLOCKED
  ) {
    return 'status-muted';
  }
  if (
    status === ItemStatus.EXCHANGED ||
    status === ExchangeStatus.COMPLETED ||
    status === FulfillmentStatus.COMPLETED
  ) {
    return 'status-done';
  }
  return 'status-wait';
};

export const formatStatusMessage = (status: ItemStatus | ExchangeStatus) => STATUS_MESSAGE_MAP[status];
