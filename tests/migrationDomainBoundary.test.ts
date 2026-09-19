import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// audit_say and CTA_tax_law share one Supabase project: audit_say owns cpa_*/common_* objects and CTA owns cta_*.
// An audit_say migration may change a cta_* object only if it is grandfathered below or states
// `-- cross-domain: <reason>` in its leading comment block.
const MIGRATIONS = new URL('../supabase/migrations/', import.meta.url);
const MIGRATION_NAME = /^\d{14}_[a-z0-9_]+\.sql$/;

// Frozen: only migrations that predate this gate may be listed. Newer ones declare the header marker instead.
const GRANDFATHER_FROZEN_AT = '20260915090000';
const GRANDFATHERED: Readonly<Record<string, string>> = Object.freeze({
    '20260910090000_common_accounts.sql':
        '공유 계정 일원화 공동 마이그레이션이다(CTA_tax_law에 같은 버전의 사본이 있고, 두 서비스를 멈춘 뒤 한 번 적용). '
        + 'cta_user·cta_subscription·cta_payment_log·cta_referral 등에 멤버십 열·트리거·권한·FK를 추가하고 cta_usage_receipts를 만든다.',
    '20260913010000_cpa_billing.sql':
        'common_withdraw_service를 재정의한다. 그 CTA 탈퇴 분기(cta_user·cta_usage_receipts·cta_grading_attempt·cta_problem_assist·'
        + 'cta_referral·cta_subscription 갱신·삭제)는 20260910090000_common_accounts.sql의 코드를 그대로 옮긴 것이며 cta_* 객체의 DDL은 없다.',
});

// Literal text is dropped only where it can never run as SQL: COMMENT ... IS text and RAISE messages.
// DO and function bodies, EXECUTE/format() strings and SQL kept in variables are scanned like any other
// statement, because blanking them would hide exactly what this gate looks for.
const PROSE_BEFORE_LITERAL = /\b(?:is|raise(?:\s+(?:exception|warning|notice|info|log|debug))?|(?:message|detail|hint)\s*=)\s*$/i;

function sqlCode(sql: string): string {
    const token = /(--[^\n]*)|(\/\*)|("(?:[^"]|"")*")|([eE]'(?:[^'\\]|\\[\s\S]|'')*'|'(?:[^']|'')*')|(\$(?:[A-Za-z_]\w*)?\$)|[\w$]+|[\s\S]/y;
    let code = '';
    let match: RegExpExecArray | null;
    while ((match = token.exec(sql)) !== null) {
        const [text, lineComment, blockComment, quotedName, literal, dollarTag] = match;
        if (lineComment) code += ' ';
        else if (blockComment) {
            let depth = 1, at = token.lastIndex; // block comments nest in PostgreSQL
            while (depth > 0 && at < sql.length) {
                if (sql.startsWith('/*', at)) { depth++; at += 2; } else if (sql.startsWith('*/', at)) { depth--; at += 2; } else at++;
            }
            token.lastIndex = at;
            code += ' ';
        } else if (quotedName) code += quotedName.slice(1, -1).replaceAll('""', '"');
        else if (literal || dollarTag) {
            let body: string;
            if (dollarTag) {
                const end = sql.indexOf(dollarTag, token.lastIndex);
                body = sql.slice(token.lastIndex, end < 0 ? sql.length : end);
                token.lastIndex = end < 0 ? sql.length : end + dollarTag.length;
            } else body = literal.slice(literal.indexOf("'") + 1, -1).replaceAll("''", "'");
            // Recursing keeps a literal's quotes and comments inside its bounds; `;` keeps a match from crossing its edge.
            code += PROSE_BEFORE_LITERAL.test(code.slice(-120)) ? ' ' : ` ; ${sqlCode(body)} ; `;
        } else code += text;
    }
    return code;
}

const CTA_NAME = /\bcta_[\w$]*/i;
// The name right after the verb: DML targets, and FK targets (an FK adds RI triggers to the referenced table).
const NAMED_TARGET = /\b(?:insert\s+into|merge\s+into|update|delete\s+from|references)\s+(?:only\s+)?[\w$]+(?:\s*\.\s*[\w$]+)*/gi;
// DDL: the words naming the object(s), up to where the statement body starts. `on <table>` stays in, so CREATE
// INDEX/TRIGGER/POLICY and DROP TRIGGER/POLICY count their table; ALTER TABLE ... DROP/ALTER COLUMN|CONSTRAINT don't.
const DDL = /\b(?:create|truncate|comment\s+on|(?:alter|drop)\b(?!\s+(?:column|constraint)\b))\b[^;()]*?(?=[;()]|\b(?:as|is|to|from|for|with|using|execute|returns|add|alter|drop|rename|owner|set|reset|enable|disable|default|cascade|restrict)\b|$)/gi;
// GRANT/REVOKE: the object list between ON and TO/FROM, not the privilege or role lists.
const PRIVILEGE = /\b(?:grant|revoke)\b[^;]*?\bon\b([^;]*?)\b(?:to|from)\b/gi;

function ctaChanges(sql: string): string[] {
    const code = sqlCode(sql).replace(/\s+/g, ' ');
    return [...code.matchAll(NAMED_TARGET), ...code.matchAll(DDL)].filter(match => CTA_NAME.test(match[0]))
        .concat([...code.matchAll(PRIVILEGE)].filter(match => CTA_NAME.test(match[1])))
        .map(match => match[0].trim());
}

// `-- cross-domain: <reason>` counts only in the leading comment block, before the first statement.
function crossDomainReason(sql: string): string | null {
    for (const line of sql.split('\n').map(text => text.trim())) {
        if (!line) continue;
        if (!line.startsWith('--')) return null;
        const reason = /^--\s*cross-domain:(.*)$/i.exec(line)?.[1].trim();
        if (reason) return reason;
    }
    return null;
}

const migrationFiles = fs.readdirSync(MIGRATIONS).sort();
const readMigration = (file: string) => fs.readFileSync(new URL(file, MIGRATIONS), 'utf8');

test('migration files are named <14-digit version>_<lowercase snake case>.sql', () => {
    assert.ok(migrationFiles.length > 0, 'supabase/migrations 가 비었습니다.');
    assert.deepEqual(migrationFiles.filter(file => !MIGRATION_NAME.test(file)), [],
        '마이그레이션 파일명은 <14자리 버전>_<소문자·숫자·밑줄>.sql 형식이어야 합니다.');
});

test('the cta_* scanner sees statements in bodies and literals, but not comments, reads or messages', () => {
    for (const sql of [
        'alter table public.cta_user add column x int;',
        'ALTER TABLE "public"."cta_user" ENABLE ROW LEVEL SECURITY;',
        'update only public.cta_user set x = 1;',
        'insert into cta_usage_receipts values (1);',
        'delete from public.cta_problem_assist;',
        'truncate public.cpa_x, public.cta_y;',
        'drop table if exists public.cpa_x, public.cta_y cascade;',
        'drop trigger if exists t on public.cta_user;',
        'create index on public.cta_user (email);',
        'create trigger t before insert or update on public.cta_user for each row execute function public.f();',
        'create policy p on public.cta_user for select using (true);',
        'create table public.cpa_x (user_id uuid references public.cta_user(id));',
        'grant select, update (email) on public.cta_user to authenticated;',
        'revoke all on public.cpa_users, public.cta_user from anon;',
        "comment on column public.cta_user.email is 'x';",
        'do $$ begin alter table public.cta_user add column y int; end $$;',
        'create function public.common_f() returns void language sql as $fn$ delete from public.cta_referral $fn$;',
        "do $$ begin execute 'drop table public.cta_x'; end $$;",
        "select 'a -- b'; alter table public.cta_user add column z int;",
        "select '/*'; alter table public.cta_user add column z int; select '*/';",
    ]) assert.notDeepEqual(ctaChanges(sql), [], `cta_* 변경을 놓쳤습니다: ${sql}`);
    for (const sql of [
        '-- alter table public.cta_user add column x int;',
        '/* outer /* nested */ update public.cta_user set x = 1; */',
        'select * from public.cta_user where id = 1 for update;',
        'update public.cpa_users set nickname = (select nickname from public.cta_user);',
        'insert into public.cpa_x select * from public.cta_y;',
        'create view public.cpa_v as select * from public.cta_user;',
        'alter table public.cpa_cta_bridge add column x int;',
        'revoke insert, update, delete on public.cpa_users from anon;',
        "comment on table public.cpa_x is 'never update cta_user here';",
        "do $$ begin raise exception 'cannot delete from cta_user'; end $$;",
    ]) assert.deepEqual(ctaChanges(sql), [], `cta_* 변경이 아닌데 잡았습니다: ${sql}`);
    assert.equal(crossDomainReason('-- 설명\n-- cross-domain: CTA와 합의한 열 추가\nbegin;'), 'CTA와 합의한 열 추가');
    assert.equal(crossDomainReason('-- cross-domain:\nbegin;'), null);
    assert.equal(crossDomainReason('begin;\n-- cross-domain: 머리 주석이 아님\n'), null);
});

test('only grandfathered or cross-domain-marked migrations change cta_* objects', () => {
    const unmarked = migrationFiles.flatMap(file => {
        const sql = readMigration(file), changes = ctaChanges(sql);
        return changes.length && !Object.hasOwn(GRANDFATHERED, file) && !crossDomainReason(sql)
            ? [`${file}: ${changes.slice(0, 3).join(' | ')}`] : [];
    });
    assert.deepEqual(unmarked, [],
        'CTA_tax_law 소유(cta_*) 객체를 바꾸는 마이그레이션입니다. CTA 쪽과 합의한 변경이면 파일 머리 주석에 '
        + '`-- cross-domain: <이유>`를 적고, 아니면 cpa_*/common_* 객체만 바꾸세요.');
});

test('the grandfather list is frozen, justified and still needed', () => {
    for (const [file, reason] of Object.entries(GRANDFATHERED)) {
        assert.ok(file.slice(0, 14) <= GRANDFATHER_FROZEN_AT, `${file}: 동결 이후 마이그레이션은 예외 목록 대신 머리 주석에 cross-domain 이유를 적으세요.`);
        assert.ok(reason.trim(), `${file}: 예외 이유가 비었습니다.`);
        assert.ok(migrationFiles.includes(file), `${file}: 파일이 없습니다.`);
        assert.notDeepEqual(ctaChanges(readMigration(file)), [], `${file}: cta_* 변경이 더 없으므로 예외 목록에서 빼세요.`);
    }
});
