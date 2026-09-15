import { ExchangeStatus } from './exchange';
import { FulfillmentStatus } from './fulfillment';
import { ItemStatus } from './item';

export const PAGE_MESSAGES = {
  homeEmpty: '暂时没有符合条件的闲置物品',
  publishReady: '发布后会同步写入 localStorage 和 IndexedDB',
  exchangeEmpty: '还没有交换请求，先去首页挑一件合眼缘的物品',
  profileUpdated: '个人资料已更新',
};

export const FORM_MESSAGES = {
  requiredTitle: '物品标题不能为空',
  requiredDescription: '请描述你希望交换的物品',
  requiredPhone: '请填写联系方式',
  imageLimit: '最多上传 4 张图片',
  exchangeNeedOwnItem: '请先发布一件可交换物品',
};

export const FULFILLMENT_MESSAGES = {
  codeLabel: '履约码',
  confirmSuccess: '已确认履约，等待对方确认',
  confirmDuplicate: '你已确认过本次履约，无需重复操作',
  completed: '双方确认完成，物品状态已更新',
  waitingOther: '已确认，等待对方确认',
  notParty: '只有交换双方可以确认履约',
  notReady: '交换当前不在履约确认阶段',
  exchangeMissing: '交换请求不存在',
  fulfillmentMissing: '履约记录不存在',
  itemMissing: '关联物品不存在，无法完成履约',
  directCompleteForbidden: '交换完成需双方在履约模块中各自确认',
};

export const LOG_MESSAGES = {
  storageHydrated: 'storage hydrated with status maps',
  storageRollbackFailed: 'storage rollback failed after partial write',
  itemStatusUsed: `ItemStatus includes ${ItemStatus.AVAILABLE}, ${ItemStatus.EXCHANGED}, ${ItemStatus.OFFLINE}`,
  exchangeStatusUsed: `ExchangeStatus includes ${ExchangeStatus.PENDING}, ${ExchangeStatus.ACCEPTED}, ${ExchangeStatus.REJECTED}, ${ExchangeStatus.COMPLETED}`,
  fulfillmentStatusUsed: `FulfillmentStatus includes ${FulfillmentStatus.CONFIRMING}, ${FulfillmentStatus.COMPLETED}`,
};

export const STATUS_MESSAGE_MAP = {
  [ItemStatus.AVAILABLE]: '这件物品可发起交换',
  [ItemStatus.EXCHANGED]: '这件物品已完成交换',
  [ItemStatus.OFFLINE]: '这件物品已下架',
  [ExchangeStatus.PENDING]: '等待对方确认',
  [ExchangeStatus.ACCEPTED]: '交换已同意，可确认完成',
  [ExchangeStatus.REJECTED]: '交换请求已拒绝',
  [ExchangeStatus.COMPLETED]: '交换流程已完成',
};
