import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

// Creates exactly one disposable verified account without sending email. It is
// removed through the deployed account-deletion API, with scoped cleanup on error.
const args = process.argv.slice(2);
process.loadEnvFile('.env.local');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const project = new URL(url).hostname.split('.')[0];
if (!args.includes('--apply') || args[args.indexOf('--expected-project') + 1] !== project
  || project !== 'xvifzicrjmbfqaepcfpp') throw new Error('Explicit production verification and exact project required');
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const manifest = JSON.parse(await readFile('tmp/common-account-rollout-manifest.json', 'utf8'));
const managementHeaders = { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' };
async function query(sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method: 'POST', headers: managementHeaders, body: JSON.stringify({ query: sql, read_only: true }), signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Verification query failed (${response.status})`);
  return response.json();
}
async function assertEmpty() {
  const [counts] = await query('select (select count(*) from auth.users) as users,(select count(*) from common_profiles) as profiles');
  if (Number(counts.users) !== 0 || Number(counts.profiles) !== 0) throw new Error('Verification requires the completed empty-account reset');
}
const configResponse = await fetch(`https://api.supabase.com/v1/projects/${project}/config/auth`, { headers: managementHeaders });
if (!configResponse.ok) throw new Error('Auth configuration unavailable');
const config = await configResponse.json();
if (!config.disable_signup || config.external_anonymous_users_enabled) throw new Error('Keep public signup paused while verifying the empty reset');
await assertEmpty();
const auditOrigin = 'https://audit-say.vercel.app';
const ctaOrigin = 'https://cta-tax-law.vercel.app';
const auditCookies = new Map();
const ctaCookies = new Map();
const cookieHeader = jar => [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
async function ctaForm(path, fields, formMarker, expectedRedirect) {
  const page = await fetch(ctaOrigin + path, { headers: { Cookie: cookieHeader(ctaCookies) }, redirect: 'manual' });
  if (!page.ok) throw new Error(`CTA form ${path} unavailable (${page.status})`);
  const html = await page.text();
  const form = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(match => match[0]).find(value => value.includes(formMarker));
  const action = form?.match(/name="(\$ACTION_ID_[^"]+)"/);
  if (!action) throw new Error(`CTA ${path} server action not found`);
  const data = new FormData();
  data.set(action[1], '');
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  const response = await fetch(ctaOrigin + path, { method: 'POST', body: data, redirect: 'manual',
    headers: { Origin: ctaOrigin, Referer: ctaOrigin + path, Cookie: cookieHeader(ctaCookies) }, signal: AbortSignal.timeout(30000) });
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(';', 1)[0], separator = pair.indexOf('=');
    ctaCookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  const destination = new URL(response.headers.get('location') || '/missing-redirect', ctaOrigin);
  if (response.status !== 303 || destination.pathname !== expectedRedirect || destination.searchParams.has('error')) throw new Error(`CTA ${path} action failed (${response.status}, ${destination.pathname})`);
}
async function auditRequest(path, method = 'GET', body) {
  const response = await fetch(auditOrigin + path, {
    method, headers: { Origin: auditOrigin, Cookie: cookieHeader(auditCookies), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined, redirect: 'manual', signal: AbortSignal.timeout(30000),
  });
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(';', 1)[0], separator = pair.indexOf('=');
    auditCookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  if (!response.ok) throw new Error(`Deployed audit ${method} ${path} failed (${response.status})`);
  return response.json();
}
const nickname = 'Check' + randomBytes(3).toString('hex');
const changedNickname = 'Check' + randomBytes(3).toString('hex');
const email = `rollout-${randomBytes(8).toString('hex')}@example.invalid`;
const password = randomBytes(32).toString('base64url') + 'Aa1!';
let testId;
const checks = [];
try {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nickname } });
  if (created.error || !created.data.user) throw new Error('Disposable verification account creation failed');
  testId = created.data.user.id;
  await auditRequest('/api/account/login', 'POST', { identifier: nickname, password });
  let snapshot = await auditRequest('/api/account');
  if (snapshot.user.id !== testId || snapshot.membership !== null) throw new Error('Login must not enroll a service');
  checks.push('common-nickname-login-and-explicit-enrollment');
  await auditRequest('/api/account/service', 'POST', { action: 'join' });
  snapshot = await auditRequest('/api/account');
  if (snapshot.membership?.status !== 'active' || snapshot.membership.isAdmin || snapshot.entitlement.kind !== 'free') throw new Error('Fresh audit membership permissions failed');
  const firstVersion = snapshot.membership.version;
  await ctaForm('/login', { email, password }, 'name="password"', '/join');
  const ctaBeforeJoin = await admin.from('cta_user').select('id').eq('id', testId).maybeSingle();
  if (ctaBeforeJoin.error || ctaBeforeJoin.data) throw new Error('CTA login unexpectedly enrolled the service');
  await ctaForm('/join', { accept: 'on' }, 'name="accept"', '/');
  const ctaJoined = await admin.from('cta_user').select('membership_status,is_service_admin,tier').eq('id', testId).single();
  if (ctaJoined.error || ctaJoined.data.membership_status !== 'active' || ctaJoined.data.is_service_admin
    || ctaJoined.data.tier !== 'member') throw new Error('CTA join unexpectedly granted a paid or admin role');
  await auditRequest('/api/account', 'PATCH', { nickname: changedNickname });
  ctaCookies.clear();
  await ctaForm('/login', { email: changedNickname, password }, 'name="password"', '/');
  checks.push('deployed-cta-nickname-and-email-login-and-explicit-enrollment');
  const ctaProfile = await fetch(ctaOrigin + '/mypage/profile', { headers: { Cookie: cookieHeader(ctaCookies) }, redirect: 'manual', signal: AbortSignal.timeout(30000) });
  if (!ctaProfile.ok || !(await ctaProfile.text()).includes(changedNickname)) throw new Error('Deployed CTA did not render the changed common nickname');
  checks.push('same-auth-account-and-common-nickname-in-both-live-apps');
  await auditRequest('/api/account/service', 'POST', { action: 'withdraw', membershipVersion: firstVersion, confirmation: '감사 서비스 탈퇴', currentPassword: password });
  const withdrawnSnapshot = await auditRequest('/api/account');
  if (withdrawnSnapshot.membership?.status !== 'withdrawn' || withdrawnSnapshot.membership.isAdmin
    || withdrawnSnapshot.entitlement.kind !== 'free' || withdrawnSnapshot.progress.exp !== 0) throw new Error('Audit withdrawal did not end service access and reset progress');
  const ctaState = await admin.from('cta_user').select('membership_status,is_service_admin').eq('id', testId).single();
  if (ctaState.error || ctaState.data.membership_status !== 'active' || ctaState.data.is_service_admin) throw new Error('Audit withdrawal changed CTA permissions');
  await auditRequest('/api/account/service', 'POST', { action: 'join' });
  snapshot = await auditRequest('/api/account');
  if (snapshot.membership.version !== firstVersion + 1 || snapshot.entitlement.kind !== 'free' || snapshot.progress.exp !== 0) throw new Error('Clean rejoin failed');
  checks.push('service-only-withdrawal-and-fresh-rejoin');
  const deleted = await auditRequest('/api/account', 'DELETE', { confirmation: '통합 계정 삭제', currentPassword: password });
  if (!deleted.ok || deleted.cleanupPending) throw new Error('Deployed global account deletion incomplete');
  testId = undefined;
  await assertEmpty();
  const [content] = await query('select (select count(*) from public.cpa_question_sets) as cpa_sets,(select count(*) from public.cta_problem) as cta_problems');
  if (Number(content.cpa_sets) !== Number(manifest.content.cpa_sets) || Number(content.cta_problems) !== Number(manifest.content.cta_problems)) throw new Error('Content counts changed during verification');
  checks.push('deployed-global-deletion-and-content-preservation');
  const result = { verifiedAt: new Date().toISOString(), project, checks, testAccountRemoved: true, realEmailsSent: 0, paymentsMade: 0 };
  await writeFile('tmp/common-account-production-verification.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  if (testId) {
    const prepared = await admin.rpc('common_prepare_account_deletion', { p_user_id: testId });
    if (prepared.error || prepared.data?.ready_for_auth_delete !== true) throw new Error('Disposable account cleanup needs attention');
    const deleted = await admin.auth.admin.deleteUser(testId, false);
    if (deleted.error) throw new Error('Disposable account removal failed');
  }
}
