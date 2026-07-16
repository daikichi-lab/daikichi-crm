-- 未実装機能の実装に伴うRPC追加:
--  1) 議事録の手動取込・要点編集（Notta自動連携の代替＝OAuth不要の常時利用パス）
--  2) メルマガ実送信の app 層連携（送信対象取得・失敗記録）
--  3) 公開フォームのハニーポット＋IPレート制限（不正投稿対策）

-- ========== 1) 議事録 ==========
-- 手動取込: 貼り付け/TXT アップロードから議事録を作成。活動「議事録」を自動記録（FR-AC2）。
create or replace function create_note(p jsonb) returns jsonb language plpgsql as $$
declare v notes;
begin
  if coalesce(p->>'title','') = '' then return jsonb_build_object('error','タイトルは必須です'); end if;
  insert into notes(company_id, title, summary, next_actions, full_text, source, occurred_at)
  values(
    nullif(p->>'company_id','')::uuid, p->>'title', nullif(p->>'summary',''),
    coalesce((select array(select jsonb_array_elements_text(p->'next_actions'))), '{}'),
    nullif(p->>'full_text',''), coalesce(nullif(p->>'source',''),'手動取込'),
    coalesce(nullif(p->>'occurred_at','')::timestamptz, now()))
  returning * into v;
  perform app_log_activity(v.company_id, null, '議事録', v.title || ' を取り込み', 'note', v.id::text);
  return jsonb_build_object('id', v.id);
end $$;

-- 要点（自動まとめ）の人手補正。
create or replace function update_note_summary(p_id text, p_summary text) returns jsonb language sql as $$
  update notes set summary = nullif(p_summary,'') where id::text = p_id;
  select jsonb_build_object('ok', true);
$$;

-- ========== 2) メルマガ実送信（app層と連携） ==========
-- 送信対象（status='送信' で email あり）を app 層が取得して実メール送信する。
create or replace function newsletter_recipients_for_send(p_id text) returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', nr.id, 'email', nr.email, 'name', nr.name, 'company', nr.company,
      'unsubscribe_token', ct.unsubscribe_token
    )), '[]'::jsonb)
  from newsletter_recipients nr left join contacts ct on ct.id = nr.contact_id
  where nr.newsletter_id::text = p_id and nr.status = '送信' and nr.email is not null and nr.email <> ''
$$;

-- 実送信の結果、失敗した宛先を '失敗' にし、newsletters の集計を更新する。
create or replace function mark_newsletter_failed(p_id text, p_failed text[]) returns jsonb language plpgsql as $$
declare sent int; failed int;
begin
  if p_failed is not null and array_length(p_failed, 1) is not null then
    update newsletter_recipients set status = '失敗'
    where newsletter_id::text = p_id and status = '送信' and email = any(p_failed);
  end if;
  select count(*) filter (where status='送信'), count(*) filter (where status='失敗')
    into sent, failed from newsletter_recipients where newsletter_id::text = p_id;
  update newsletters set sent_count = sent, failed_count = failed where id::text = p_id;
  return jsonb_build_object('sent', sent, 'failed', failed);
end $$;

-- ========== 3) 公開フォーム: ハニーポット＋IPレート制限 ==========
alter table form_submissions add column if not exists client_ip text;

-- 旧シグネチャ(jsonb)を破棄して2引数版に置き換える（オーバーロード曖昧化を防ぐ）。
drop function if exists submit_public_form(jsonb);
create or replace function submit_public_form(p jsonb, p_ip text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v form_submissions; recent int;
begin
  -- ハニーポット: ボットが埋める隠しフィールド _hp が埋まっていたら、受理したように見せて破棄（DoS通知回避）。
  if coalesce(p->>'_hp','') <> '' then return jsonb_build_object('ok', true); end if;
  -- 簡易レート制限: 同一IPから10分に5件まで。
  if p_ip is not null and p_ip <> '' then
    select count(*) into recent from form_submissions
    where client_ip = p_ip and created_at > now() - interval '10 minutes';
    if recent >= 5 then return jsonb_build_object('error','送信が続いています。しばらく時間をおいて再度お試しください。'); end if;
  end if;
  insert into form_submissions(payload, status, client_ip) values(p - '_hp', '未対応', nullif(p_ip,''))
  returning * into v;
  insert into activities(kind, title, source, source_kind, source_id, status, actor_label)
  values('フォーム', '公開フォームから新規問い合わせを受信（未取込）: ' || coalesce(p->>'name','(無名)'), '自動', 'form', v.id::text, '未対応', 'システム')
  on conflict (source_kind, source_id) where source_kind is not null and source_id is not null do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- ========== 権限 ==========
revoke execute on all functions in schema public from public;
grant execute on all functions in schema public to authenticated;
-- 公開フォーム送信は anon（security definer）
grant execute on function submit_public_form(jsonb, text) to anon;
