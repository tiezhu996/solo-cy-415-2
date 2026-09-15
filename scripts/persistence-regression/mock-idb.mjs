/**
 * idb-keyval 的内存模拟：
 * - 与 src/utils/storage.ts 的 localStorage 镜像配合，构成双写持久层；
 * - 支持注入「指定 key 下一次写入失败」，验证失败回滚与重试。
 */
export const __failOnceFor = { key: null };

const store = new Map();

export const __dump = () => Object.fromEntries(store.entries());

export const get = async (key) => store.get(key);

export const set = async (key, val) => {
  if (__failOnceFor.key === key) {
    __failOnceFor.key = null;
    throw new Error(`injected idb failure for ${key}`);
  }
  store.set(key, val);
};

export const del = async (key) => {
  store.delete(key);
};
