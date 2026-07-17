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

describe('期限・タスク v2（親子課題・進捗集計・コメント/履歴）', () => {
  const PARENT = 'eeeeeeee-0000-0000-0000-000000000004'; // 海風マリン 申告（子3: 完了100/対応中50/未対応0）

  it('app_list_schedule はスコープ件数・親子件数を返す', async () => {
    const r = await call(`select app_list_schedule() r`);
    expect(r.scope_all).toBe(r.scope_client + r.scope_internal);
    expect(r.parents).toBeGreaterThanOrEqual(3);
    expect(r.children).toBeGreaterThanOrEqual(9);
    expect(r.scope_internal).toBeGreaterThanOrEqual(6);
  });

  it('親課題の進捗は子課題から自動集計される（(100+50+0)/3=50%）', async () => {
    const r = await call(`select app_get_task('${PARENT}') r`);
    expect(r.progress).toBe(50);
    expect(r.children.length).toBe(3);
    expect(r.comments.length).toBe(2);
    expect(r.events.length).toBeGreaterThanOrEqual(3);
  });

  it('create_task: 親を指定すると子課題になり企業・スコープを引き継ぐ（担当は氏名でも解決）', async () => {
    const c = await call(`select create_task('{"title":"単体テスト子課題","parent_id":"${PARENT}","assignee":"佐藤 京子"}'::jsonb) r`);
    expect(c.id).toBeTruthy();
    const t = await call(`select app_get_task('${c.id}') r`);
    expect(t.parent.id).toBe(PARENT);
    expect(t.scope).toBe('client');
    expect(t.company).toBe('合同会社 海風マリン');
    expect(t.assignee).toBe('佐藤 京子');
    // 親の進捗が再集計される（子4件: 100+50+0+0 = 38%）
    const p = await call(`select app_get_task('${PARENT}') r`);
    expect(p.progress).toBe(38);
    // 完了で 63% へ・履歴イベントが親子に残る
    await call(`select complete_schedule_item('${c.id}') r`);
    const p2 = await call(`select app_get_task('${PARENT}') r`);
    expect(p2.progress).toBe(63);
    expect(p2.events[0].body).toContain('単体テスト子課題');
    // 後片付け（以降のテストの集計を汚さない）
    await db.query(`update schedule_items set deleted_at = now() where id = '${c.id}'`);
  });

  it('子課題の下に子課題は作れない（2階層まで）', async () => {
    const child = 'eeeeeeee-0000-0000-0000-000000000006';
    const r = await call(`select create_task('{"title":"孫課題","parent_id":"${child}"}'::jsonb) r`);
    expect(r.error).toContain('子課題');
  });

  it('update_schedule_item: 状態変更が履歴（events）に残る', async () => {
    const c = await call(`select create_task('{"title":"状態変更テスト"}'::jsonb) r`);
    await call(`select update_schedule_item('${c.id}', '{"status":"対応中"}'::jsonb) r`);
    const t = await call(`select app_get_task('${c.id}') r`);
    expect(t.status).toBe('対応中');
    expect(t.events.map((e: any) => e.body)).toContain('状態を 未対応 → 対応中 に変更');
    await db.query(`update schedule_items set deleted_at = now() where id = '${c.id}'`);
  });

  it('自動生成は削除不可・手動は子課題ごと論理削除', async () => {
    const auto = await call(`select delete_task('${PARENT}') r`);
    expect(auto.error).toBeTruthy();
    const p = await call(`select create_task('{"title":"削除テスト親"}'::jsonb) r`);
    const c = await call(`select create_task('{"title":"削除テスト子","parent_id":"${p.id}"}'::jsonb) r`);
    const del = await call(`select delete_task('${p.id}') r`);
    expect(del.ok).toBe(true);
    expect((await call(`select app_get_task('${p.id}') r`)).error).toBeTruthy();
    expect((await call(`select app_get_task('${c.id}') r`)).error).toBeTruthy();
  });

  it('p_status=open は未完了のみ・p_q は題名/企業の部分一致', async () => {
    const all = await call(`select app_list_schedule() r`);
    const open = await call(`select app_list_schedule(p_status := 'open') r`);
    expect(open.count).toBeLessThan(all.count);
    expect(open.items.every((i: any) => i.status !== '完了')).toBe(true);
    const q = await call(`select app_list_schedule(p_q := '海風') r`);
    expect(q.count).toBeGreaterThanOrEqual(4);
    expect(q.items.every((i: any) => (i.company ?? '').includes('海風') || i.title.includes('海風'))).toBe(true);
  });

  it('add_task_comment: 投稿できる・空はエラー', async () => {
    const ng = await call(`select add_task_comment('${PARENT}', '') r`);
    expect(ng.error).toBeTruthy();
    const ok = await call(`select add_task_comment('${PARENT}', '単体テストコメント') r`);
    expect(ok.id).toBeTruthy();
    const t = await call(`select app_get_task('${PARENT}') r`);
    expect(t.comments[t.comments.length - 1].body).toBe('単体テストコメント');
    expect(t.comments[t.comments.length - 1].author).toBe('山田 健太');
  });

  it('app_task_form_lookup: 企業/スコープで親課題・議事録・資料を絞る', async () => {
    const r = await call(`select app_task_form_lookup('aaaaaaaa-0000-0000-0000-000000000009', 'client') r`);
    expect(r.parents.some((p: any) => p.id === PARENT)).toBe(true);
    expect(r.docs.length).toBeGreaterThanOrEqual(2);
    const i = await call(`select app_task_form_lookup(null, 'internal') r`);
    expect(i.parents.length).toBeGreaterThanOrEqual(3);
    expect(i.docs.length).toBe(0);
  });
});

describe('活動履歴の自動記録（FR-AC2/AC7/AC9・0009）', () => {
  it('タスク完了で活動「タスク」が自動記録され、二重記録されない（冪等）', async () => {
    const t = await call(`select create_task('{"title":"自動記録テスト","company_id":"aaaaaaaa-0000-0000-0000-000000000001"}'::jsonb) r`);
    await call(`select complete_schedule_item('${t.id}') r`);
    const n1 = (await db.query(`select count(*)::int n from activities where source_kind='task' and source_id='${t.id}'`)).rows[0].n;
    expect(n1).toBe(1);
    // 取り消して再完了しても活動は1件のまま（source_kind+source_id 一意）
    await call(`select update_schedule_item('${t.id}', '{"status":"未対応"}'::jsonb) r`);
    await call(`select update_schedule_item('${t.id}', '{"status":"完了"}'::jsonb) r`);
    const n2 = (await db.query(`select count(*)::int n from activities where source_kind='task' and source_id='${t.id}'`)).rows[0].n;
    expect(n2).toBe(1);
    const a = (await db.query(`select kind, status, company_id from activities where source_kind='task' and source_id='${t.id}'`)).rows[0];
    expect(a.kind).toBe('タスク');
    expect(a.status).toBe('完了');
    await db.query(`update schedule_items set deleted_at = now() where id = '${t.id}'`);
  });

  it('名刺取込で活動「名刺」が担当者付きで自動記録される', async () => {
    const ct = (await db.query(`select id, company_id from contacts where deleted_at is null limit 1`)).rows[0];
    const card = await call(`select upload_business_card('${ct.id}', 'cards/test-front.jpg') r`);
    const a = (await db.query(`select kind, contact_id, company_id from activities where source_kind='card' and source_id='${card.id}'`)).rows[0];
    expect(a.kind).toBe('名刺');
    expect(a.contact_id).toBe(ct.id);
    expect(a.company_id).toBe(ct.company_id);
  });

  it('フォーム取込で活動「フォーム(取込)」を記録し、受信活動のフォロー待ちを解消する', async () => {
    const sub = await call(`select submit_public_form('{"name":"自動記録フォーム商事","type":"法人"}'::jsonb) r`);
    expect(sub.ok).toBe(true);
    const sid = (await db.query(`select id from form_submissions where payload->>'name'='自動記録フォーム商事'`)).rows[0].id;
    // 受信時は未対応（フォロー待ち）
    expect((await db.query(`select status from activities where source_kind='form' and source_id='${sid}'`)).rows[0].status).toBe('未対応');
    const imp = await call(`select import_form_submission('${sid}') r`);
    expect(imp.company_id).toBeTruthy();
    // 受信活動が完了になり、取込活動が追加される
    expect((await db.query(`select status from activities where source_kind='form' and source_id='${sid}'`)).rows[0].status).toBe('完了');
    const a = (await db.query(`select kind, status, company_id from activities where source_kind='form_import' and source_id='${sid}'`)).rows[0];
    expect(a.kind).toBe('フォーム');
    expect(a.company_id).toBe(imp.company_id);
  });
});

describe('セッション失効: 無効化ユーザーは解決されない（security review 指摘1・0010）', () => {
  it('app_get_user は active=true のみ解決し、無効化で NULL を返す（getCurrentUser のバックエンド）', async () => {
    await asUser(db, YAMADA);
    // 使い捨てユーザーを作成（seed の3名はテスト決定性のため触らない）
    const uid = 'aaaaaaaa-dead-beef-0000-000000000001';
    await db.query(`insert into app_users(id,name,email,role,active,avatar_initial)
      values('${uid}','失効テスト','revoke-test@daikichi.example','staff',true,'失') on conflict (id) do nothing`);
    // 有効なら解決
    const ok = await call(`select app_get_user('${uid}') r`);
    expect(ok?.id).toBe(uid);
    // 無効化 → app_get_user は NULL（＝getCurrentUser が null を返しセッション失効）
    await db.query(`update app_users set active=false where id='${uid}'`);
    const gone = await call(`select app_get_user('${uid}') r`);
    expect(gone).toBeNull();
    // ログイン経路（app_find_user_by_email）も無効ユーザーを拒否（従来どおり）
    const login = await call(`select app_find_user_by_email('revoke-test@daikichi.example') r`);
    expect(login).toBeNull();
    await db.query(`delete from app_users where id='${uid}'`);
  });
});

describe('公開フォーム設定: マージ保存・公開停止・レート制限（0012）', () => {
  beforeAll(async () => { await asUser(db, YAMADA); });

  it('update_form_config は部分保存で既存値を消さない（浅いマージ）', async () => {
    await call(`select update_form_config('{"title":"設定T1","intro":"設定I1","published":true}'::jsonb) r`);
    await call(`select update_form_config('{"published":false}'::jsonb) r`);
    const cfg = await call(`select get_public_form_config() r`);
    expect(cfg.title).toBe('設定T1');   // 部分保存で消えていない
    expect(cfg.intro).toBe('設定I1');
    expect(cfg.published).toBe(false);
    await call(`select update_form_config('{"published":true}'::jsonb) r`); // 後片付け
  });

  it('published=false のとき submit_public_form は受付を拒否する（fail-closed）', async () => {
    await call(`select update_form_config('{"published":false}'::jsonb) r`);
    const res = await call(`select submit_public_form('{"name":"停止中テスト","type":"法人"}'::jsonb) r`);
    expect(res.error).toBeTruthy();
    await call(`select update_form_config('{"published":true}'::jsonb) r`);
  });

  it('ハニーポット _hp が埋まっていると受理扱いで破棄（保存しない）', async () => {
    const before = (await db.query(`select count(*)::int n from form_submissions`)).rows[0].n;
    const res = await call(`select submit_public_form('{"name":"ボット","_hp":"trap"}'::jsonb) r`);
    expect(res.ok).toBe(true);
    const after = (await db.query(`select count(*)::int n from form_submissions`)).rows[0].n;
    expect(after).toBe(before); // 実体は保存されていない
  });

  it('レート制限: 同一IPは10分5件まで、rate_limit=false で解除', async () => {
    const ip = '203.0.113.9';
    await call(`select update_form_config('{"published":true,"rate_limit":true}'::jsonb) r`);
    for (let i = 0; i < 5; i++) {
      const r = await call(`select submit_public_form(('{"name":"RL${i}","type":"法人"}')::jsonb, '${ip}') r`);
      expect(r.ok).toBe(true);
    }
    const sixth = await call(`select submit_public_form('{"name":"RL6","type":"法人"}'::jsonb, '${ip}') r`);
    expect(sixth.error).toBeTruthy(); // 6件目は拒否
    await call(`select update_form_config('{"rate_limit":false}'::jsonb) r`);
    const ok = await call(`select submit_public_form('{"name":"RL7","type":"法人"}'::jsonb, '${ip}') r`);
    expect(ok.ok).toBe(true); // 無効化で通る
    await call(`select update_form_config('{"rate_limit":true}'::jsonb) r`);
  });
});

describe('メルマガ集計 get_newsletter_segment（0013）', () => {
  it('同意あり件数(count)・配信停止件数(unsubscribed)を数値で返す（画面KPIの実データ化）', async () => {
    const seg = await call(`select get_newsletter_segment(null,null,null,null) r`);
    expect(typeof seg.count).toBe('number');
    expect(seg.count).toBeGreaterThanOrEqual(0);
    expect(typeof seg.unsubscribed).toBe('number');
    expect(seg.unsubscribed).toBeGreaterThanOrEqual(0);
  });
});
