#!/usr/bin/env node
/**
 * scripts/migrate.js — 원격 Supabase(PostgreSQL)에 SQL 마이그레이션 직접 실행 러너
 *
 * 사용법:
 *   node scripts/migrate.js                       # supabase/migrations 의 모든 *.sql 을 이름순 실행
 *   node scripts/migrate.js 006_cert_lang_bulk_seed.sql   # 특정 파일만 실행
 *   node scripts/migrate.js path/to/file.sql ...  # 여러 파일 순서대로 실행
 *
 * 연결 정보: .env.local 의 DATABASE_URL (또는 키 없이 적힌 postgres:// 라인) 자동 인식.
 *   - 비밀번호가 [ ... ] 로 감싸진 경우(자리표시자 괄호 잔존) 자동 제거.
 *   - 비밀번호의 @ ? 등 특수문자는 URI 파싱 대신 분해 파싱으로 안전 처리.
 *
 * ⚠️ 운영 DB에 직접 쓰기를 수행합니다. 마이그레이션은 멱등(재실행 안전)하게 작성되어야 합니다.
 */

const fs   = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT          = path.resolve(__dirname, '..');
const ENV_PATH      = path.join(ROOT, '.env.local');
const MIGRATION_DIR = path.join(ROOT, 'supabase', 'migrations');

// ── .env.local 에서 연결 문자열 로드 ─────────────────────────
function loadConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();

  if (!fs.existsSync(ENV_PATH)) {
    throw new Error(`.env.local 을 찾을 수 없습니다: ${ENV_PATH}`);
  }
  const lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const s = raw.trim();
    if (!s || s.startsWith('#')) continue;

    // KEY=value 형태
    const kv = s.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (kv) {
      const key = kv[1];
      let val = kv[2].trim().replace(/^['"]|['"]$/g, '');
      if (key === 'DATABASE_URL' && val) return val;
      if (/^postgres(ql)?:\/\//i.test(val)) return val;  // 다른 키명이라도 postgres URL이면 수용
      continue;
    }
    // 키 없이 적힌 bare 연결 문자열
    if (/^postgres(ql)?:\/\//i.test(s)) return s.replace(/^['"]|['"]$/g, '');
  }
  throw new Error('.env.local 에서 DATABASE_URL(또는 postgres:// 연결 문자열)을 찾지 못했습니다.');
}

// ── 연결 문자열 → pg Client 설정으로 분해 (특수문자/괄호 안전) ──
function parseConnection(url) {
  // postgres://USER:PASSWORD@HOST:PORT/DB?params
  // PASSWORD 에 @, ? 가 있을 수 있으므로 host 직전 마지막 @ 를 기준으로 분해(greedy).
  const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:@/]+):(\d+)\/([^?]+)(?:\?(.*))?$/i);
  if (!m) throw new Error('연결 문자열 형식을 해석할 수 없습니다 (postgres://user:pass@host:port/db).');

  let [, user, password, host, port, database] = m;
  // 자리표시자 대괄호 [ ... ] 잔존 시 제거
  if (password.startsWith('[') && password.endsWith(']')) {
    password = password.slice(1, -1);
  }

  // IPv4 풀러 등으로의 호스트/사용자/포트 오버라이드 (비밀번호는 .env.local 유지)
  if (process.env.PG_HOST_OVERRIDE) host = process.env.PG_HOST_OVERRIDE;
  if (process.env.PG_USER_OVERRIDE) user = process.env.PG_USER_OVERRIDE;
  if (process.env.PG_PORT_OVERRIDE) port = process.env.PG_PORT_OVERRIDE;

  return {
    user,
    password,
    host,
    port: Number(port),
    database,
    ssl: { rejectUnauthorized: false },   // Supabase 는 SSL 필수
  };
}

// ── 실행 대상 파일 목록 결정 ──────────────────────────────────
function resolveTargets(args) {
  if (args.length === 0) {
    if (!fs.existsSync(MIGRATION_DIR)) throw new Error(`마이그레이션 폴더 없음: ${MIGRATION_DIR}`);
    return fs.readdirSync(MIGRATION_DIR)
      .filter((f) => f.toLowerCase().endsWith('.sql'))
      .sort()
      .map((f) => path.join(MIGRATION_DIR, f));
  }
  return args.map((a) => {
    const candidates = [path.resolve(ROOT, a), path.join(MIGRATION_DIR, a), path.join(ROOT, a)];
    const found = candidates.find((p) => fs.existsSync(p));
    if (!found) throw new Error(`SQL 파일을 찾을 수 없습니다: ${a}`);
    return found;
  });
}

// ── 단일 파일 실행 (트랜잭션 래핑 + RAISE NOTICE 출력) ─────────
async function runFile(client, file) {
  const sql  = fs.readFileSync(file, 'utf8');
  const name = path.basename(file);
  console.log(`\n▶ 실행: ${name} (${sql.length.toLocaleString()} bytes)`);
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`✓ 완료: ${name}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`✗ 실패(롤백됨): ${name}\n   ${err.message}`);
    throw err;
  }
}

async function main() {
  const targets = resolveTargets(process.argv.slice(2));
  const cfg = parseConnection(loadConnectionString());
  console.log(`DB 연결: ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database} (SSL)`);
  console.log(`대상 파일 ${targets.length}개:`, targets.map((t) => path.basename(t)).join(', '));

  const client = new Client(cfg);
  // 서버측 RAISE NOTICE 메시지 표시 (시드 건수 확인용)
  client.on('notice', (n) => console.log(`   ⓘ ${n.message}`));

  await client.connect();
  try {
    for (const file of targets) await runFile(client, file);
    console.log('\n✅ 모든 마이그레이션 실행 완료.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\n❌ 마이그레이션 중단:', err.message);
  process.exit(1);
});
