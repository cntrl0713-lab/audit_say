import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const R = 'cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14';
const output = `${R}/pgp-transport-probe-v2`;
const input = `${R}/db-publication-v2/payload.json`;
const gpg = 'C:/Program Files/Git/usr/bin/gpg.exe';
const project = 'xvifzicrjmbfqaepcfpp';
// Public transport constant. This probe makes NO confidentiality/encryption-protection claim.
const passphrase = 'audit-say-public-compressed-transport-v1';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const ref = file => ({ file, sha256: hash(fs.readFileSync(file)), bytes: fs.statSync(file).size });
const write = (name, data) => fs.writeFileSync(`${output}/${name}`, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
assert(!fs.existsSync(output), 'Preserve prior probe; choose a fresh output version.');
assert(fs.existsSync(gpg));
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, project + '.supabase.co');
assert(process.env.SUPABASE_ACCESS_TOKEN);
fs.mkdirSync(output);
const homedir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-pgp-'));
// Git's gpg is an MSYS binary and does not interpret C:/ paths as absolute.
const gpgPath = file => path.resolve(file).replaceAll('\\', '/').replace(/^([A-Za-z]):\//, (_, drive) => '/' + drive.toLowerCase() + '/');
const original = fs.readFileSync(input), inputRef = ref(input);
const version = spawnSync(gpg, ['--version'], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
assert.equal(version.status, 0);
write('preparation.json', { prepared_at: new Date().toISOString(), mode: 'read_only_transport_probe', input: inputRef,
    helper: ref(`${R}/pgp-transport-probe.mjs`), gpg: ref(gpg), version: version.stdout.split(/\r?\n/).slice(0, 3),
    options: ['--batch', '--pinentry-mode', 'loopback', '--symmetric', '--compress-algo', 'ZLIB', '--cipher-algo', 'AES256'],
    public_nonsecurity_passphrase: passphrase, confidentiality_claim: false, isolated_homedir: homedir,
    database_write_statements: 0, ddl_statements: 0, api_read_only: true });
function encrypt(file, destination) {
    const r = spawnSync(gpg, ['--no-options', '--homedir', gpgPath(homedir), '--batch', '--pinentry-mode', 'loopback', '--passphrase', passphrase,
        '--symmetric', '--compress-algo', 'ZLIB', '--cipher-algo', 'AES256', '--output', gpgPath(destination), gpgPath(file)],
        { encoding: 'utf8', windowsHide: true, timeout: 60000 });
    assert.equal(r.status, 0, `gpg encryption exit ${r.status}; ${r.error?.code ?? 'no process error'}`);
}
const encryptedFile = `${output}/payload.pgp`;
encrypt(input, encryptedFile);
const decrypted = spawnSync(gpg, ['--no-options', '--homedir', gpgPath(homedir), '--batch', '--pinentry-mode', 'loopback', '--passphrase', passphrase,
    '--decrypt', gpgPath(encryptedFile)], { windowsHide: true, timeout: 60000, maxBuffer: original.length + 1024 * 1024 });
assert.equal(decrypted.status, 0); assert(Buffer.isBuffer(decrypted.stdout)); assert.deepEqual(decrypted.stdout, original);
const encrypted = fs.readFileSync(encryptedFile);
write('local-roundtrip.json', { status: 'pass', original: inputRef, compressed_container: ref(encryptedFile),
    base64_bytes: Buffer.byteLength(encrypted.toString('base64')), ratio: encrypted.length / original.length,
    decrypted_sha256: hash(decrypted.stdout), decrypted_bytes: decrypted.stdout.length, exact_bytes_equal: true,
    confidentiality_claim: false, source_document_sha256: hash(JSON.parse(original.toString('utf8')).source_document) });
const requests = [];
async function query(label, sql) {
    const body = JSON.stringify({ query: sql, read_only: true });
    const request = { label, request_sha256: hash(body), request_bytes: Buffer.byteLength(body), sql_sha256: hash(sql), api_read_only: true };
    requests.push(request);
    const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
        method: 'POST', headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
        body, signal: AbortSignal.timeout(60000),
    });
    request.http_status = response.status;
    const result = await response.json();
    if (!response.ok) {
        const message = typeof result?.message === 'string' ? result.message : '';
        request.sqlstate = message.match(/ERROR:\s+([0-9A-Z]{5}):/)?.[1] ?? null;
        throw new Error(`Read-only probe ${label} HTTP ${response.status}, SQLSTATE ${request.sqlstate ?? 'unavailable'}; response omitted.`);
    }
    assert(Array.isArray(result));
    return result;
}
try {
    const functions = await query('pgcrypto-capability', `select n.nspname as schema,p.proname as name,pg_get_function_identity_arguments(p.oid) as arguments from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname in ('pgp_sym_decrypt','pgp_sym_decrypt_bytea') order by n.nspname,p.proname,p.oid`);
    write('pgcrypto-capability.json', { checked_at: new Date().toISOString(), functions });
    const decryptor = functions.find(f => f.name === 'pgp_sym_decrypt_bytea' && f.arguments === 'bytea, text');
    assert(decryptor, 'Existing pgcrypto bytea decrypt function absent; do not install anything.');
    assert(/^[a-z_][a-z0-9_]*$/.test(decryptor.schema));
    const sampleFile = `${output}/sample.txt`, sample = Buffer.from('audit-say transport sample: 한글\n', 'utf8');
    fs.writeFileSync(sampleFile, sample, { flag: 'wx' }); encrypt(sampleFile, `${output}/sample.pgp`);
    const decodeSql = bytes => `${decryptor.schema}.pgp_sym_decrypt_bytea(decode('${bytes.toString('base64')}','base64'),'${passphrase}')`;
    const sampleResult = await query('sample-decryption', `with decoded as materialized(select ${decodeSql(fs.readFileSync(`${output}/sample.pgp`))} as b) select encode(sha256(b),'hex') as sha256,octet_length(b) as bytes,current_setting('transaction_read_only') as transaction_read_only from decoded`);
    assert.equal(sampleResult.length, 1); assert.equal(sampleResult[0].sha256, hash(sample)); assert.equal(sampleResult[0].bytes, sample.length); assert.equal(sampleResult[0].transaction_read_only, 'on');
    write('sample-roundtrip.json', { status: 'pass', input: ref(sampleFile), result: sampleResult });
    const payload = JSON.parse(original.toString('utf8'));
    const full = await query('full-payload-decryption', `with decoded as materialized(select ${decodeSql(encrypted)} as b),parsed as materialized(select b,convert_from(b,'UTF8')::jsonb as p from decoded) select encode(sha256(b),'hex') as payload_sha256,octet_length(b) as payload_bytes,encode(sha256(convert_to(p->>'source_document','UTF8')),'hex') as source_document_sha256,octet_length(p->>'source_document') as source_document_bytes,jsonb_array_length(p->'sets') as set_count,(p->'sets')=((p->>'source_document')::jsonb) as sets_equal_source_document,current_setting('transaction_read_only') as transaction_read_only from parsed`);
    assert.equal(full.length, 1); const row = full[0];
    assert.equal(row.payload_sha256, inputRef.sha256); assert.equal(row.payload_bytes, original.length);
    assert.equal(row.source_document_sha256, hash(payload.source_document)); assert.equal(row.source_document_bytes, Buffer.byteLength(payload.source_document));
    assert.equal(row.set_count, payload.sets.length); assert.equal(row.sets_equal_source_document, true); assert.equal(row.transaction_read_only, 'on');
    assert.deepEqual(ref(input), inputRef, 'Original payload changed during probe.');
    write('completion.json', { completed_at: new Date().toISOString(), status: 'pass', unused_fallback_prepared: true,
        input: inputRef, compressed_container: ref(encryptedFile), result: row, requests,
        local_and_database_decryption_exact_sha_equal: true, api_read_only: true,
        ddl_statements: 0, bank_write_statements: 0, actual_model_calls: 0, confidentiality_claim: false });
    process.stdout.write(JSON.stringify({ status: 'pass', original_bytes: original.length, compressed_bytes: encrypted.length,
        base64_bytes: Buffer.byteLength(encrypted.toString('base64')), full_query_bytes: requests.at(-1).request_bytes,
        payload_sha256: row.payload_sha256, set_count: row.set_count, output }) + '\n');
} catch (error) {
    write('failure.json', { failed_at: new Date().toISOString(), status: 'failed_read_only_probe', message: error.message, requests,
        api_read_only: true, ddl_statements: 0, bank_write_statements: 0, automatic_retry: false });
    throw error;
}
