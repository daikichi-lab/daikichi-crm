import { describe, it, expect, beforeAll } from 'vitest';
import { buildDb, asUser, asAnon } from '../../scripts/db-validate.mjs';

const YAMADA = '11111111-1111-1111-1111-111111111111';
const SATO = '22222222-2222-2222-2222-222222222222';
let db: any;
const call = async (sql: string) => (await db.query(sql)).rows[0].r;

beforeAll(async () => {
  db = await buildDb({ seed: true });
  await asUser(db, YAMADA);
});

describe('検索/マッチング RPC（crm-demo と同一ロジック・C-6）', () => {
  it('find_matches(大吉商事) = 佐藤デザイン:2 / みどり:1 / テック:1', async () => {
    const r = await call(`select find_matches('株式会社 大吉商事') r`);
    expect(r.matches.map((m: any) => `${m.company}:${m.score}`)).toEqual(['佐藤デザイン事務所:2', 'みどり食堂:1', 'テック合同会社:1']);
  });
  it('search_companies は全条件 AND（東京都×顧問中=2）', async () => {
    const r = await call(`select search_companies(null,null,'東京都','顧問中') r`);
    expect(r.count).toBe(2);
  });
  it('needs タグは配列membership（集客=5社）', async () => {
    const r = await call(`select search_companies(null,null,null,null,'集客') r`);
    expect(r.count).toBe(5);
  });
  it('list_tags は13タグ', async () => {
    expect((await call(`select list_tags() r`)).count).toBe(13);
  });
  it('suggest_matches は score>0 を降順', async () => {
    const r = await call(`select suggest_matches(5) r`);
    expect(r.top[0].score).toBeGreaterThanOrEqual(r.top[r.top.length - 1].score);
  });
});

describe('PII マスク（SEC-X4）', () => {
  it('get_company 既定マスク、reveal=true で復元', async () => {
    const masked = await call(`select get_company('大吉商事') r`);
    expect(masked.contacts[0].email).toBe('s***@daikichi-shoji.co.jp');
    expect(masked.contacts[0].phone).toMatch(/\*/);
    const revealed = await call(`select get_company('大吉商事', true) r`);
    expect(revealed.contacts[0].email).toBe('sato@daikichi-shoji.co.jp');
  });
  it('get_company_timeline は連絡先(メール/電話)を返さない（SEC-13）', async () => {
    const r = await call(`select get_company_timeline('株式会社 大吉商事') r`);
    expect(JSON.stringify(r)).not.toMatch(/@|\d{2,4}-\d{2,4}-\d{4}/);
    expect(r.count).toBeGreaterThan(0);
  });
});

describe('資料検索（メタのみ・SEC-12）', () => {
  it('search_documents(カタログ)=2件・本体や署名URLを返さない', async () => {
    const r = await call(`select search_documents('カタログ') r`);
    expect(r.count).toBe(2);
    expect(JSON.stringify(r)).not.toMatch(/storage_path|signed|http/i);
  });
});

describe('RLS（SEC-1/2）', () => {
  it('anon は companies / RPC にアクセスできない', async () => {
    await asAnon(db);
    await expect(db.query('select count(*) from companies')).rejects.toThrow(/permission denied/);
    await expect(db.query(`select search_companies()`)).rejects.toThrow(/permission denied/);
    await asUser(db, YAMADA); // 後続テストのため戻す
  });
  it('staff は app_users を変更できない（admin専用ポリシー）', async () => {
    await asUser(db, SATO);
    expect((await call(`select app_is_admin() r`))).toBe(false);
    await db.query(`update app_users set name='x' where id='${YAMADA}'`); // 0行(RLSフィルタ)
    const n = (await db.query(`select count(*)::int n from app_users where name='x'`)).rows[0].n;
    expect(n).toBe(0);
    await asUser(db, YAMADA);
  });
});

describe('書き込み・冪等', () => {
  it('regenerate_auto_schedule は2回呼んでも重複しない（rule_key冪等）', async () => {
    await asUser(db, YAMADA);
    await call(`select regenerate_auto_schedule() r`);
    const a = (await call(`select app_list_schedule() r`)).count;
    await call(`select regenerate_auto_schedule() r`);
    const b = (await call(`select app_list_schedule() r`)).count;
    expect(b).toBe(a);
  });
  it('send_newsletter は opt_in×topic 重なりのみ送信、他は停止スキップ', async () => {
    const r = await call(`select send_newsletter('{"subject":"T","topic_ids":["セミナー・勉強会案内"]}'::jsonb) r`);
    expect(r.sent).toBeGreaterThan(0);
    expect(r.sent + r.skipped).toBe(r.target);
  });
});
