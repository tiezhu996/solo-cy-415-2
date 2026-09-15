import type { FulfillmentStatus } from '@/constants/fulfillment';
import type { Exchange } from '@/models/exchange';

export type FulfillmentRole = 'initiator' | 'receiver';

export interface FulfillmentConfirmation {
  user_id: string;
  role: FulfillmentRole;
  confirmed_at: string;
}

export interface ExchangeFulfillment {
  id: string;
  exchange_id: string;
  code: string;
  status: FulfillmentStatus;
  confirmations: FulfillmentConfirmation[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface FulfillmentConfirmResult {
  fulfillment: ExchangeFulfillment;
  exchange: Exchange;
  /** 本次确认是否触发了双方收口（交换完成、物品变更） */
  completed: boolean;
  /** 是否为幂等命中：重复确认或完成后的重试，不产生任何变更 */
  alreadyConfirmed: boolean;
}
