// Run with: node --test tests/generate.test.cjs
// Only the provider and database are stubbed; storage uses the installed Blob SDK.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS harness for the transpiled route and Blob SDK. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
const blob = require('@vercel/blob');
const { createRequire } = require('node:module');
const blobRequire = createRequire(require.resolve('@vercel/blob'));
const { MockAgent, setGlobalDispatcher, getGlobalDispatcher } = blobRequire('undici');
const source = ts.transpileModule(readFileSync('src/app/api/generate/route.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');

function route({ databaseFails = false } = {}) {
  const calls = { generated: 0, records: [] };
  const mocks = {
    '@huggingface/inference': { InferenceClient: class {
      async textToImage() { calls.generated++; return new Blob([png], { type: 'image/png' }); }
    } },
    '@google/genai': { GoogleGenAI: class {
      models = { generateContent: async () => {
        calls.generated++;
        return { candidates: [{ content: { parts: [{ inlineData: { data: png.toString('base64'), mimeType: 'image/png' } }] } }] };
      } };
    } },
    '@/lib/db': { db: {
      printRecord: { create: async ({ data }) => {
        if (databaseFails) throw new Error('fixture database failure');
        const record = { id: 'test-print', ...data, createdAt: new Date().toISOString() };
        calls.records.push(record);
        return record;
      } },
    } },
    '@/lib/request-identity': {
      resolveRequestIdentity: async () => ({
        user: null,
        userId: null,
        anonymousSessionHash: 'fixture-session-hash',
      }),
    },
  };
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', source)(name => mocks[name] || require(name), mod.exports, mod);
  return { calls, post: (model = 'flux') => mod.exports.POST(new Request('http://localhost/api/generate', {
    method: 'POST', body: JSON.stringify({ prompt: 'A red cube', model, userId: 'untrusted-user' }),
  })) };
}

test('generation and storage regression coverage (no external network)', { timeout: 10000 }, async t => {
  const previousEnv = { ...process.env };
  const previousDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  delete process.env.BLOB_STORE_ID;
  delete process.env.VERCEL_OIDC_TOKEN;
  delete process.env.VERCEL_BLOB_API_URL;
  delete process.env.NEXT_PUBLIC_VERCEL_BLOB_API_URL;
  process.env.HF_TOKEN = 'fixture';
  process.env.GEMINI_API_KEY = 'fixture';
  t.after(async () => {
    process.env = previousEnv;
    setGlobalDispatcher(previousDispatcher);
    await agent.close();
  });

  await t.test('real SDK diagnoses a missing token', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    await assert.rejects(blob.put('test.png', png, { access: 'public' }), /No blob credentials found/);
  });

  await t.test('missing storage fails before generation or database writes', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = '  ';
    const { post, calls } = route();
    const response = await post();
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'STORAGE_NOT_CONFIGURED');
    assert.equal(calls.generated, 0);
    assert.equal(calls.records.length, 0);
  });

  await t.test('invalid model remains a client error without configured storage', async () => {
    assert.equal((await route().post('invalid')).status, 400);
  });

  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_fixture_secret';
  const pool = agent.get('https://vercel.com');
  for (const model of ['flux', 'sdxl', 'gemini']) {
    await t.test(`${model}: image bytes -> SDK upload -> record -> readable image URL`, async () => {
      const imageUrl = `https://fixture.public.blob.vercel-storage.com/${model}.png`;
      pool.intercept({ method: 'PUT', path: /^\/api\/blob\/\?pathname=prints%2Fiprintr_/ }).reply(200, options => {
        assert.deepEqual(Buffer.from(options.body), png);
        return { url: imageUrl, downloadUrl: imageUrl, pathname: `${model}.png`, contentType: 'image/png', contentDisposition: 'inline' };
      });
      agent.get('https://fixture.public.blob.vercel-storage.com')
        .intercept({ path: `/${model}.png`, method: 'GET' }).reply(200, png, { headers: { 'content-type': 'image/png' } });
      const { post, calls } = route();
      const response = await post(model);
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.imageUrl, imageUrl);
      assert.equal(result.record.imageUrl, imageUrl);
      assert.equal(result.record.userId, null);
      assert.equal(result.record.anonymousSessionHash, 'fixture-session-hash');
      assert.equal(calls.records.length, 1);
      const image = await blobRequire('undici').fetch(result.imageUrl);
      assert.equal(image.headers.get('content-type'), 'image/png');
      assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
    });
  }

  await t.test('OIDC uploads without a legacy read/write token', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    process.env.BLOB_STORE_ID = 'store_fixture';
    const oidcToken = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.fixture`;
    // Vercel production supplies the token through request context only.
    delete process.env.VERCEL_OIDC_TOKEN;
    const contextKey = Symbol.for('@vercel/request-context');
    const previousContext = globalThis[contextKey];
    globalThis[contextKey] = { get: () => ({ headers: { 'x-vercel-oidc-token': oidcToken } }) };
    pool.intercept({ method: 'PUT', path: /^\/api\/blob\/\?pathname=prints%2Fiprintr_/ }).reply(200, options => {
      const headers = new Headers(options.headers);
      assert.equal(headers.get('authorization'), `Bearer ${oidcToken}`);
      assert.equal(headers.get('x-vercel-blob-store-id'), 'fixture');
      return { url: 'https://fixture.public.blob.vercel-storage.com/oidc.png', pathname: 'oidc.png', contentType: 'image/png' };
    });
    const { post, calls } = route();
    try {
      assert.equal((await post()).status, 200);
      assert.equal(calls.records.length, 1);
    } finally {
      if (previousContext === undefined) delete globalThis[contextKey];
      else globalThis[contextKey] = previousContext;
    }
    delete process.env.BLOB_STORE_ID;
    delete process.env.VERCEL_OIDC_TOKEN;
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_fixture_secret';
  });

  await t.test('rejected token reports storage configuration failure and saves no record', async () => {
    pool.intercept({ method: 'PUT', path: /^\/api\/blob\/\?pathname=prints%2Fiprintr_/ })
      .reply(403, { error: { code: 'forbidden', message: 'Forbidden' } });
    const { post, calls } = route();
    const response = await post();
    assert.equal(response.status, 503);
    const result = await response.json();
    assert.equal(result.code, 'STORAGE_CONFIGURATION_ERROR');
    assert.equal(calls.records.length, 0);
    assert.equal(JSON.stringify(result).includes('fixture_secret'), false);
  });

  await t.test('database failure is reported instead of returning a fake history record', async () => {
    const imageUrl = 'https://fixture.public.blob.vercel-storage.com/database-failure.png';
    pool.intercept({ method: 'PUT', path: /^\/api\/blob\/\?pathname=prints%2Fiprintr_/ })
      .reply(200, { url: imageUrl, pathname: 'database-failure.png', contentType: 'image/png' });
    const { post } = route({ databaseFails: true });
    const response = await post();
    const result = await response.json();
    assert.equal(response.status, 503);
    assert.equal(result.code, 'DATABASE_SAVE_FAILED');
    assert.equal(result.imageUrl, imageUrl);
    assert.equal(result.record, undefined);
  });
  agent.assertNoPendingInterceptors();
});
