/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS harness for the transpiled database module. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
const source = ts.transpileModule(readFileSync('src/lib/db.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

test('database accepts integration and legacy variable names without a live connection', () => {
  const names = ['IPRINTR_DATABASE_URL', 'IPRINTR_POSTGRES_URL', 'IPRINTR_PRISMA_DATABASE_URL', 'IPRINTR_URL', 'IPRINTR_PRISMA_URL', 'POSTGRES_URL'];
  for (const name of names) {
    let options;
    const mod = { exports: {} };
    new Function('require', 'exports', 'module', 'process', 'globalThis', source)(
      () => ({ PrismaClient: class { constructor(value) { options = value; } } }),
      mod.exports, mod, { env: { NODE_ENV: 'test', [name]: 'postgres://fixture' } }, {},
    );
    assert.equal(options.datasources.db.url, 'postgres://fixture', name);
  }
});
