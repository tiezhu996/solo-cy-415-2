/**
 * 持久化回归测试运行器：
 * 1. 注入 localStorage 内存实现（node 环境没有）；
 * 2. 用 esbuild 打包 scripts/persistence-regression/suite.ts（别名对齐 vite 配置）；
 * 3. 执行打包产物，退出码即测试结果。
 *
 * 用法：pnpm test:regression
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outFile = path.join(root, 'scripts/persistence-regression/.out.mjs');

// node 环境没有 localStorage / navigator.locks，注入内存版（与浏览器行为一致的单机实现）
const localMem = new Map();
globalThis.localStorage = {
  getItem: (key) => (localMem.has(key) ? localMem.get(key) : null),
  setItem: (key, value) => localMem.set(key, String(value)),
  removeItem: (key) => localMem.delete(key),
};

await build({
  entryPoints: [path.join(root, 'scripts/persistence-regression/suite.ts')],
  outfile: outFile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  alias: {
    '@': path.join(root, 'src'),
    'idb-keyval': path.join(root, 'scripts/persistence-regression/mock-idb.mjs'),
  },
  logLevel: 'silent',
});

await import(outFile);
