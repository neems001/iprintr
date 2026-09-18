/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS harness for the transpiled identity module. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');

const source = ts.transpileModule(readFileSync('src/lib/request-identity.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function identityModule({ oauth = false, storedToken } = {}) {
  const calls = { cookie: null, synced: null };
  const cookieStore = {
    get: () => storedToken ? { value: storedToken } : undefined,
    set: (name, value, options) => { calls.cookie = { name, value, options }; },
  };
  const databaseUser = {
    id: 'local-user',
    email: 'person@example.com',
    name: 'Test Person',
    authProviderId: 'oauth-user',
  };
  const mocks = {
    '@clerk/nextjs/server': {
      auth: async () => ({ userId: oauth ? 'oauth-user' : null }),
      currentUser: async () => ({
        id: 'oauth-user',
        firstName: 'Test',
        lastName: 'Person',
        username: null,
        primaryEmailAddressId: 'email-1',
        emailAddresses: [{ id: 'email-1', emailAddress: 'PERSON@example.com' }],
      }),
    },
    'next/headers': { cookies: async () => cookieStore },
    '@/lib/auth-config': { isOAuthConfigured: () => oauth },
    '@/lib/db': { db: {
      user: {
        findUnique: async ({ where }) => where.authProviderId ? databaseUser : null,
        update: async () => databaseUser,
        create: async () => databaseUser,
      },
      printRecord: {
        updateMany: async (args) => { calls.synced = args; return { count: 2 }; },
      },
    } },
  };
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', source)(name => mocks[name] || require(name), mod.exports, mod);
  return { ...mod.exports, calls };
}

test('guest session uses an HTTP-only cookie and stores only its hash', async () => {
  const identity = identityModule();
  const result = await identity.resolveRequestIdentity();

  assert.equal(result.userId, null);
  assert.equal(result.anonymousSessionHash.length, 64);
  assert.equal(identity.calls.cookie.name, 'iprintr_anonymous_session');
  assert.equal(identity.calls.cookie.options.httpOnly, true);
  assert.equal(identity.calls.cookie.options.sameSite, 'lax');
  assert.notEqual(result.anonymousSessionHash, identity.calls.cookie.value);
});

test('OAuth sync assigns matching guest records to the verified user', async () => {
  const storedToken = 'a'.repeat(43);
  const identity = identityModule({ oauth: true, storedToken });
  const result = await identity.resolveRequestIdentity();

  assert.equal(result.userId, 'local-user');
  assert.equal(result.anonymousSessionHash, null);
  assert.deepEqual(identity.calls.synced, {
    where: { anonymousSessionHash: identity.hashAnonymousSession(storedToken) },
    data: { userId: 'local-user', anonymousSessionHash: null },
  });
  assert.equal(identity.calls.cookie, null);
});
