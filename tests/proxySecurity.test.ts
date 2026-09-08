import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import type { NextRequest, NextResponse } from 'next/server';
import nextConfig from '../next.config.ts';

const require = createRequire(import.meta.url);
const nextServer = require('next/server') as typeof import('next/server');
type CookiesAdapter = {
    getAll: () => Array<{ name: string; value: string }>;
    setAll: (cookies: Array<{ name: string; value: string; options: { path: string } }>, headers: Record<string, string>) => void;
};

// Execute the actual proxy with a simulated Auth refresh and real Next request/response objects.
// No live sessions, credentials or network requests are needed.
function loadProxy(refresh: boolean) {
    const compiled = ts.transpileModule(fs.readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const exports = {} as { proxy: (request: NextRequest) => Promise<NextResponse> };
    vm.runInNewContext(compiled, {
        exports,
        process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://auth.example.test', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-public-key' } },
        require(name: string) {
            if (name === 'next/server') return nextServer;
            if (name === '@supabase/ssr') return {
                createServerClient: (_url: string, _key: string, { cookies }: { cookies: CookiesAdapter }) => ({
                    auth: { getUser: async () => {
                        if (refresh) cookies.setAll([{ name: 'test-session', value: 'refreshed-session', options: { path: '/' } }], {
                            'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
                            Expires: '0', Pragma: 'no-cache',
                        });
                        return { data: { user: null }, error: null };
                    } },
                }),
            };
            throw new Error(`Unexpected dependency: ${name}`);
        },
    });
    return exports.proxy;
}

test('refreshed session response retains Supabase cache prevention and downstream cookie', async () => {
    const request = new nextServer.NextRequest('https://audit.example.test/');
    const response = await loadProxy(true)(request);
    assert.equal(request.cookies.get('test-session')?.value, 'refreshed-session');
    assert.equal(response.cookies.get('test-session')?.value, 'refreshed-session');
    assert.match(response.headers.get('cache-control') ?? '', /private.*no-store/);
    assert.equal(response.headers.get('expires'), '0');
    assert.equal(response.headers.get('pragma'), 'no-cache');
});

test('public requests without a session refresh do not set session cookies', async () => {
    const response = await loadProxy(false)(new nextServer.NextRequest('https://audit.example.test/'));
    assert.equal(response.headers.get('set-cookie'), null);
});

test('all routes prevent framing, MIME sniffing and unsafe base URL changes', async () => {
    const rules = await nextConfig.headers!();
    const rule = rules.find((entry) => entry.source === '/:path*');
    assert.ok(rule);
    const headers = Object.fromEntries(rule.headers.map(({ key, value }) => [key, value]));
    assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/);
    assert.match(headers['Content-Security-Policy'], /base-uri 'self'/);
    assert.equal(headers['X-Frame-Options'], 'DENY');
    assert.equal(headers['X-Content-Type-Options'], 'nosniff');
});
