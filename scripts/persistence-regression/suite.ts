/**
 * 持久化回归测试：交换流程在重复刷新与重放操作后的记录稳定性。
 *
 * 运行方式：pnpm test:regression
 *
 * 规则：
 * 1. 每个阶段结束后都从持久化层重新加载（localStorage 镜像 + IndexedDB 双写一致性）；
 * 2. 任一阶段发现同一交换/履约/确认记录重复、履约码重复，立即失败，
 *    失败信息指出首次重复发生在哪个阶段；
 * 3. 每个阶段的操作都可重放，重放后不得产生重复记录；
 * 4. 最终归属（哪条交换完成）与物品结果（哪张物品已交换）必须与预期一致。
 */
import { exchangeApi } from '@/api/exchangeApi';
import { fulfillmentApi } from '@/api/fulfillmentApi';
import { itemApi } from '@/api/itemApi';
import { STORAGE_KEYS, storage } from '@/utils/storage';
import { __dump, __failOnceFor } from 'idb-keyval';

// ---------------------------------------------------------------------------
// 测试基建
// ---------------------------------------------------------------------------

const now = () => new Date().toISOString();

const makeItem = (id, userId) => ({
  id,
  user_id: userId,
  title: `物品${id}`,
  description: '回归测试物品',
  category: '数码',
  condition: 'good',
  images: [],
  status: 'available',
  location: '上海',
  created_at: now(),
});

const makeExchange = (id, fromItem, toItem, status = 'pending', fromUser = 'user_a', toUser = 'user_b') => ({
  id,
  from_user_id: fromUser,
  to_user_id: toUser,
  from_item_id: fromItem,
  to_item_id: toItem,
  status,
  message: '',
  created_at: now(),
  updated_at: now(),
});

const PERSISTED_KEYS = [STORAGE_KEYS.exchanges, STORAGE_KEYS.fulfillments, STORAGE_KEYS.items];

/** 从持久化层重新加载（模拟刷新后的首次读取） */
const reload = async () => ({
  exchanges: await storage.get(STORAGE_KEYS.exchanges, []),
  fulfillments: await storage.get(STORAGE_KEYS.fulfillments, []),
  items: await storage.get(STORAGE_KEYS.items, []),
});

const findDuplicate = (list, keyOf) => {
  const seen = new Set();
  for (const entry of list) {
    const key = keyOf(entry);
    if (seen.has(key)) return key;
    seen.add(key);
  }
  return null;
};

/** 双写一致性：localStorage 镜像与 IndexedDB 内容必须相同，否则刷新后可能读到不同数据 */
const assertPersistenceSync = (stageName) => {
  const idbDump = __dump();
  for (const key of PERSISTED_KEYS) {
    const localRaw = localStorage.getItem(key);
    const idbValue = idbDump[key];
    if (!localRaw && !idbValue) continue;
    const localPayload = localRaw ? JSON.stringify(JSON.parse(localRaw).payload) : null;
    const idbPayload = idbValue ? JSON.stringify(idbValue.payload) : null;
    if (localPayload !== idbPayload) {
      throw new Error(`阶段「${stageName}」持久层不一致：${key} 的 localStorage 与 IndexedDB 内容不同`);
    }
  }
};

/** 同一交换/履约/确认记录不得重复 */
const assertNoDuplicates = (stageName, snap) => {
  const dupExchange = findDuplicate(snap.exchanges, (e) => e.id);
  if (dupExchange) throw new Error(`阶段「${stageName}」发现重复交换记录：${dupExchange}`);

  const dupFulfillment = findDuplicate(snap.fulfillments, (f) => f.id);
  if (dupFulfillment) throw new Error(`阶段「${stageName}」发现重复履约单：${dupFulfillment}`);

  const dupBinding = findDuplicate(snap.fulfillments, (f) => f.exchange_id);
  if (dupBinding) throw new Error(`阶段「${stageName}」交换 ${dupBinding} 绑定了多张履约单`);

  const dupCode = findDuplicate(snap.fulfillments, (f) => f.code);
  if (dupCode) throw new Error(`阶段「${stageName}」发现重复履约码：${dupCode}`);

  for (const fulfillment of snap.fulfillments) {
    const dupUser = findDuplicate(fulfillment.confirmations, (c) => c.user_id);
    if (dupUser) {
      throw new Error(`阶段「${stageName}」履约单 ${fulfillment.id} 发现 ${dupUser} 的重复确认记录`);
    }
  }
};

/** 交换状态、履约状态、物品状态三者必须一致 */
const assertConsistency = (stageName, snap) => {
  for (const exchange of snap.exchanges) {
    const fulfillment = snap.fulfillments.find((f) => f.exchange_id === exchange.id);
    if (exchange.status === 'completed') {
      if (!fulfillment || fulfillment.status !== 'completed') {
        throw new Error(`阶段「${stageName}」交换 ${exchange.id} 已完成但履约单不是完成态`);
      }
      if (fulfillment.confirmations.length !== 2) {
        throw new Error(`阶段「${stageName}」交换 ${exchange.id} 已完成但确认记录不是 2 条`);
      }
      for (const itemId of [exchange.from_item_id, exchange.to_item_id]) {
        const item = snap.items.find((i) => i.id === itemId);
        if (item?.status !== 'exchanged') {
          throw new Error(`阶段「${stageName}」交换 ${exchange.id} 已完成但物品 ${itemId} 不是已交换`);
        }
      }
    }
    if (fulfillment?.status === 'completed' && exchange.status !== 'completed') {
      throw new Error(`阶段「${stageName}」履约单 ${fulfillment.id} 已完成但交换 ${exchange.id} 不是完成态`);
    }
  }
};

let currentStage = '(初始化)';

/** 阶段收尾：从持久化层重新加载并执行全部不变量校验 */
const reloadAndCheck = async (stageName) => {
  const snap = await reload();
  assertPersistenceSync(stageName);
  assertNoDuplicates(stageName, snap);
  assertConsistency(stageName, snap);
  console.log(`  ✓ 重新加载校验通过（交换 ${snap.exchanges.length} / 履约 ${snap.fulfillments.length} / 物品 ${snap.items.length}）`);
  return snap;
};

/** 执行一个阶段：先跑动作，再从持久化层重新加载校验 */
const stage = async (name, action) => {
  currentStage = name;
  console.log(`\n▶ 阶段：${name}`);
  await action();
  return reloadAndCheck(name);
};

/** 重放一组操作：重放后仍不得产生重复记录 */
const replay = async (name, action) => {
  console.log(`  ↻ 重放：${name}`);
  await action();
  return reloadAndCheck(`重放·${name}`);
};

const expectThrow = async (fn, pattern, label) => {
  try {
    await fn();
  } catch (error) {
    if (pattern.test(error.message)) return;
    throw new Error(`阶段「${currentStage}」${label} 抛出了非预期错误：${error.message}`);
  }
  throw new Error(`阶段「${currentStage}」${label} 本应失败却成功了`);
};

const check = (name, cond) => {
  if (!cond) throw new Error(`阶段「${currentStage}」断言失败：${name}`);
  console.log(`  ✓ ${name}`);
};

// ---------------------------------------------------------------------------
// 场景一：单交换全生命周期，逐阶段重放
// ---------------------------------------------------------------------------

const scenarioLifecycle = async () => {
  console.log('\n══ 场景一：单交换全生命周期 ═');
  await storage.set(STORAGE_KEYS.items, [makeItem('item_a1', 'user_a'), makeItem('item_b1', 'user_b')]);
  await storage.set(STORAGE_KEYS.exchanges, [makeExchange('ex_1', 'item_a1', 'item_b1')]);
  await storage.set(STORAGE_KEYS.fulfillments, []);

  await stage('发起交换请求已落库', async () => {
    const snap = await reload();
    check('交换请求存在且待确认', snap.exchanges.find((e) => e.id === 'ex_1')?.status === 'pending');
  });

  await stage('同意交换并生成履约码', async () => {
    await exchangeApi.transition('ex_1', 'accepted');
  });
  const code1 = (await fulfillmentApi.getByExchange('ex_1')).code;
  check('履约码格式正确', /^RS-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code1));

  await replay('重复同意（预期状态机拒绝）', async () => {
    await expectThrow(() => exchangeApi.transition('ex_1', 'accepted'), /不允许/, '重复同意');
  });

  await replay('绕过履约直接完成（预期被禁止）', async () => {
    await expectThrow(() => exchangeApi.transition('ex_1', 'completed'), /履约/, '单边完成');
  });

  await stage('发起方确认履约', async () => {
    await fulfillmentApi.confirm('ex_1', 'user_a');
  });

  await replay('发起方重复确认（幂等）', async () => {
    const result = await fulfillmentApi.confirm('ex_1', 'user_a');
    check('重复确认幂等返回', result.alreadyConfirmed === true && result.completed === false);
  });

  await stage('接收方确认并完成', async () => {
    const result = await fulfillmentApi.confirm('ex_1', 'user_b');
    check('双方确认后完成', result.completed === true);
  });

  await replay('完成后双方反复重试（幂等）', async () => {
    await fulfillmentApi.confirm('ex_1', 'user_a');
    await fulfillmentApi.confirm('ex_1', 'user_b');
  });

  const finalSnap = await stage('完成后反复刷新读取', async () => {
    const first = JSON.stringify(await reload());
    await reload();
    const second = JSON.stringify(await reload());
    check('连续刷新读取结果一致', first === second);
  });
  check('交换最终完成', finalSnap.exchanges.find((e) => e.id === 'ex_1').status === 'completed');
  check('两张物品都已交换', finalSnap.items.every((i) => i.status === 'exchanged'));
  check('履约码全程不变', finalSnap.fulfillments.find((f) => f.exchange_id === 'ex_1').code === code1);
};

// ---------------------------------------------------------------------------
// 场景二：并发同意 + 共享物品归属冲突，逐阶段重放
// ---------------------------------------------------------------------------

const scenarioConflict = async () => {
  console.log('\n══ 场景二：并发同意与共享物品归属冲突 ═');
  await storage.set(STORAGE_KEYS.items, [
    makeItem('item_x', 'user_a'),
    makeItem('item_y', 'user_b'),
    makeItem('item_z', 'user_c'),
  ]);
  await storage.set(STORAGE_KEYS.exchanges, [
    makeExchange('ex_2a', 'item_x', 'item_y'),
    makeExchange('ex_2b', 'item_x', 'item_z', 'pending', 'user_a', 'user_c'),
  ]);
  await storage.set(STORAGE_KEYS.fulfillments, []);

  await stage('两条交换同时获同意', async () => {
    await Promise.all([
      exchangeApi.transition('ex_2a', 'accepted'),
      exchangeApi.transition('ex_2b', 'accepted'),
    ]);
  });
  const snapAfterAccept = await reload();
  check('两条交换都已同意', snapAfterAccept.exchanges.every((e) => e.status === 'accepted'));
  check('两张履约单各自存在', snapAfterAccept.fulfillments.length === 2);

  await stage('两条交换的第一方分别确认', async () => {
    await fulfillmentApi.confirm('ex_2a', 'user_a');
    await fulfillmentApi.confirm('ex_2b', 'user_a');
  });

  await stage('两条交换几乎同时完成确认', async () => {
    await Promise.allSettled([
      fulfillmentApi.confirm('ex_2a', 'user_b'),
      fulfillmentApi.confirm('ex_2b', 'user_c'),
    ]);
  });

  const conflictSnap = await reload();
  const completed = conflictSnap.exchanges.filter((e) => e.status === 'completed');
  const stillAccepted = conflictSnap.exchanges.filter((e) => e.status === 'accepted');
  check('只有一条交换完成', completed.length === 1);
  check('另一条保持已同意', stillAccepted.length === 1);
  const loserId = stillAccepted[0].id;
  const loserF = conflictSnap.fulfillments.find((f) => f.exchange_id === loserId);
  check('落败方受阻且只有 1 条确认', loserF.status === 'blocked' && loserF.confirmations.length === 1);
  check('共享物品只写回一次', conflictSnap.items.find((i) => i.id === 'item_x').status === 'exchanged');

  await replay('落败方重复确认（仍受阻，无重复记录）', async () => {
    const loserSecond = loserId === 'ex_2a' ? 'user_b' : 'user_c';
    await expectThrow(() => fulfillmentApi.confirm(loserId, loserSecond), /占用|受阻/, '落败方重试');
  });

  await replay('获胜方完成后重试（幂等）', async () => {
    const winnerId = completed[0].id;
    const winnerSecond = winnerId === 'ex_2a' ? 'user_b' : 'user_c';
    const result = await fulfillmentApi.confirm(winnerId, winnerSecond);
    check('获胜方重试幂等', result.alreadyConfirmed === true && result.completed === false);
  });
};

// ---------------------------------------------------------------------------
// 场景三：收口失败回滚 + 受阻恢复，逐阶段重放
// ---------------------------------------------------------------------------

const scenarioRecovery = async () => {
  console.log('\n══ 场景三：收口失败回滚与受阻恢复 ═');
  await storage.set(STORAGE_KEYS.items, [
    makeItem('item_x3', 'user_a'),
    makeItem('item_y3', 'user_b'),
    makeItem('item_z3', 'user_c'),
  ]);
  await storage.set(STORAGE_KEYS.exchanges, [
    makeExchange('ex_3a', 'item_x3', 'item_y3'),
    makeExchange('ex_3b', 'item_x3', 'item_z3', 'pending', 'user_a', 'user_c'),
  ]);
  await storage.set(STORAGE_KEYS.fulfillments, []);
  await Promise.all([
    exchangeApi.transition('ex_3a', 'accepted'),
    exchangeApi.transition('ex_3b', 'accepted'),
  ]);
  await fulfillmentApi.confirm('ex_3a', 'user_a');
  await fulfillmentApi.confirm('ex_3b', 'user_a');

  await stage('认领方收口写入失败（注入）', async () => {
    __failOnceFor.key = STORAGE_KEYS.items;
    await expectThrow(() => fulfillmentApi.confirm('ex_3a', 'user_b'), /injected|failure/, '收口写入失败');
  });
  const afterFail = await reload();
  check('认领方保持收口执行中', afterFail.fulfillments.find((f) => f.exchange_id === 'ex_3a').status === 'closing');
  check('失败后物品未变更', afterFail.items.every((i) => i.status === 'available'));

  await stage('等待方完成确认被阻', async () => {
    await expectThrow(() => fulfillmentApi.confirm('ex_3b', 'user_c'), /占用|受阻/, '等待方确认');
  });

  await stage('认领方失去完成条件（物品下架）后释放', async () => {
    await itemApi.setStatus('item_y3', 'offline');
    const sweep = await fulfillmentApi.releaseStaleClaims();
    check('释放返回认领方', sweep.released.includes('ex_3a'));
    check('释放返回等待方', sweep.unblocked.includes('ex_3b'));
  });
  const afterRelease = await reload();
  check('认领方回到确认中且确认保留', afterRelease.fulfillments.find((f) => f.exchange_id === 'ex_3a').status === 'confirming'
    && afterRelease.fulfillments.find((f) => f.exchange_id === 'ex_3a').confirmations.length === 2);
  check('等待方解除受阻', afterRelease.fulfillments.find((f) => f.exchange_id === 'ex_3b').status === 'confirming');

  await replay('重复释放（幂等）', async () => {
    const again = await fulfillmentApi.releaseStaleClaims();
    check('无可释放对象', again.released.length === 0 && again.unblocked.length === 0);
  });

  await stage('等待方第二方确认后完成', async () => {
    const result = await fulfillmentApi.confirm('ex_3b', 'user_c');
    check('等待方完成', result.completed === true);
  });

  await stage('原认领方重试（物品已下架，受阻）', async () => {
    await expectThrow(() => fulfillmentApi.confirm('ex_3a', 'user_b'), /占用|受阻/, '原认领方重试');
  });
  const finalSnap = await reload();
  const f3a = finalSnap.fulfillments.find((f) => f.exchange_id === 'ex_3a');
  check('原认领方受阻但双方确认保留', f3a.status === 'blocked' && f3a.confirmations.length === 2);
  check('下架物品未被误写', finalSnap.items.find((i) => i.id === 'item_y3').status === 'offline');
};

// ---------------------------------------------------------------------------
// 场景四：全量重放 + 连续刷新稳定性
// ---------------------------------------------------------------------------

const scenarioStability = async () => {
  console.log('\n══ 场景四：全量重放与连续刷新稳定性 ═');

  await stage('重放全部交换的双方确认（幂等/受阻，不产生重复）', async () => {
    const { exchanges } = await reload();
    for (const exchange of exchanges) {
      for (const userId of [exchange.from_user_id, exchange.to_user_id]) {
        await fulfillmentApi.confirm(exchange.id, userId).catch(() => null);
      }
    }
  });

  await stage('连续三次刷新读取结果一致', async () => {
    const first = JSON.stringify(await reload());
    await reload();
    await reload();
    const third = JSON.stringify(await reload());
    check('三次刷新快照一致', first === third);
  });

  const finalSnap = await reload();
  const completedCount = finalSnap.exchanges.filter((e) => e.status === 'completed').length;
  const exchangedItems = finalSnap.items.filter((i) => i.status === 'exchanged');
  check('最终归属与物品结果一致', exchangedItems.length === completedCount * 2);
  check('履约码全局唯一', new Set(finalSnap.fulfillments.map((f) => f.code)).size === finalSnap.fulfillments.length);
};

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------

const main = async () => {
  const scenarios = [scenarioLifecycle, scenarioConflict, scenarioRecovery, scenarioStability];
  for (const scenario of scenarios) {
    await scenario();
  }
  console.log('\n全部场景通过：重复刷新与重放后无重复记录，最终归属与物品结果一致。');
};

main().catch((error) => {
  console.error(`\n✗ 回归失败，首次问题发生在阶段「${currentStage}」`);
  console.error(`  ${error.message}`);
  process.exit(1);
});
