/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
const source = ts.transpileModule(readFileSync('src/app/api/optimize/route.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function route(statuses) {
  const calls = [];
  const mod = { exports: {} };
  const mock = { GoogleGenAI: class { models = { generateContent: async ({model}) => {
    calls.push(model);
    const status = statuses.shift();
    if (status) throw Object.assign(new Error('provider unavailable'), { status });
    return { text: 'A ceramic cup, soft daylight' };
  } }; } };
  new Function('require', 'exports', 'module', 'process', source)(
    name => name === '@google/genai' ? mock : require(name), mod.exports, mod,
    { env: { GEMINI_API_KEY: 'fixture' } },
  );
  return { calls, post: () => mod.exports.POST(new Request('http://localhost/api/optimize', {
    method: 'POST', body: JSON.stringify({ prompt: 'A cup' }),
  })) };
}
test('temporary overload uses fallback and returns enhanced prompt', async () => {
  const {calls, post} = route([503, 0]);
  const response = await post();
  assert.equal(response.status, 200);
  assert.ok((await response.json()).optimizedPrompt);
  assert.deepEqual(calls, ['gemini-3.5-flash', 'gemini-3.6-flash']);
});
test('both providers unavailable returns a readable 503', async () => {
  const {post} = route([503, 503]);
  const response = await post();
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /temporarily busy/);
});
test('rate limits do not trigger additional provider requests', async () => {
  const {calls, post} = route([429]);
  assert.equal((await post()).status, 429);
  assert.equal(calls.length, 1);
});
