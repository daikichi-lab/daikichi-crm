-- 活動履歴の自動記録を FR-AC2 に拡充: 名刺OCR取込・期限/タスクの完了・フォーム取込。
-- あわせてフォーム活動のフォロー状態を受信箱と連動（取込/破棄で 未対応→完了）。
-- 冪等: source_kind + source_id 一意（FR-AC9）。議事録取込・資料アップロードの自動記録は
-- Notta/Storage の実接続時に各RPCへ追加する（現状はデモ動線のため書き込みRPCが無い）。

-- 共通ヘルパ: 自動活動の記録（重複はスキップ）
create or replace function app_log_activity(
  p_company uuid, p_contact uuid, p_kind text, p_title text,
  p_skind text, p_sid text, p_status text default null
) returns void language sql as $$
  insert into activities(company_id, contact_id, kind, title, source, source_kind, source_id, status, actor)
  values (p_company, p_contact, p_kind, p_title, '自動', p_skind, p_sid, p_status, auth.uid())
  on conflict (source_kind, source_id) where source_kind is not null and source_id is not null do nothing;
$$;

-- ===== 名刺OCR取込 → 活動「名刺」（FR-AC2 / FR-P） =====
create or replace function upload_business_card(p_contact_id text, p_front text, p_back text default null) returns jsonb language plpgsql as $$
declare v business_cards; ct contacts;
begin
  insert into business_cards(contact_id, front_path, back_path, ocr_status)
  values(p_contact_id::uuid, p_front, p_back, '完了') returning * into v;
  select * into ct from contacts where id = v.contact_id;
  perform app_log_activity(ct.company_id, ct.id, '名刺', ct.name || ' さんの名刺を取込・担当者に登録', 'card', v.id::text);
  return jsonb_build_object('id', v.id);
end $$;

-- ===== 期限・タスクの完了 → 活動「タスク」（FR-AC2 / FR-D5） =====
-- 0008 の complete_schedule_item / update_schedule_item に活動記録を追加した置き換え。
create or replace function complete_schedule_item(p_id text) returns jsonb language plpgsql as $$
declare o schedule_items;
begin
  select * into o from schedule_items where id::text = p_id and deleted_at is null;
  if o.id is null then return jsonb_build_object('error','not found'); end if;
  update schedule_items set status = '完了', progress = 100, done_at = now() where id::text = p_id;
  if o.status <> '完了' then
    perform app_task_event(o.id, '状態を ' || o.status || ' → 完了 に変更');
    if o.parent_id is not null then
      perform app_task_event(o.parent_id, '子課題「' || o.title || '」を完了にしました');
    end if;
    perform app_log_activity(o.company_id, null, 'タスク', o.title, 'task', o.id::text, '完了');
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function update_schedule_item(p_id text, p jsonb) returns jsonb language plpgsql as $$
declare o schedule_items; v schedule_items; nu uuid;
begin
  select * into o from schedule_items where id::text = p_id and deleted_at is null;
  if o.id is null then return jsonb_build_object('error','not found'); end if;
  nu := case when p ? 'assignee' then app_resolve_user(p->>'assignee') else o.assignee end;
  update schedule_items set
    title = case when p ? 'title' and source = '手動' then p->>'title' else title end,
    description = case when p ? 'description' then nullif(p->>'description','') else description end,
    kind = case when p ? 'kind' and source = '手動' then p->>'kind' else kind end,
    start_date = case when p ? 'start_date' and source = '手動' then nullif(p->>'start_date','')::date else start_date end,
    due_date = case when p ? 'due_date' and source = '手動' then nullif(p->>'due_date','')::date else due_date end,
    assignee = nu,
    progress = case when p ? 'progress' then least(100, greatest(0, coalesce(nullif(p->>'progress','')::int, 0)))
                    when p ? 'status' and p->>'status' = '完了' then 100 else progress end,
    status = case when p ? 'status' then p->>'status' else status end,
    done_at = case when p ? 'status' and p->>'status' = '完了' then now() when p ? 'status' then null else done_at end
  where id::text = p_id returning * into v;
  -- 変更履歴
  if p ? 'status' and v.status is distinct from o.status then
    perform app_task_event(v.id, '状態を ' || o.status || ' → ' || v.status || ' に変更');
  end if;
  if p ? 'assignee' and v.assignee is distinct from o.assignee then
    perform app_task_event(v.id, '担当を ' || coalesce((select name from app_users where id = o.assignee),'未定')
      || ' → ' || coalesce((select name from app_users where id = v.assignee),'未定') || ' に変更');
  end if;
  if p ? 'due_date' and v.due_date is distinct from o.due_date then
    perform app_task_event(v.id, '期日を ' || coalesce(to_char(o.due_date,'MM/DD'),'未定') || ' → ' || coalesce(to_char(v.due_date,'MM/DD'),'未定') || ' に変更');
  end if;
  if p ? 'progress' and v.progress is distinct from o.progress then
    perform app_task_event(v.id, '進捗を ' || o.progress || '% → ' || v.progress || '% に更新');
  end if;
  if (p ? 'title' and v.title is distinct from o.title) or (p ? 'description' and v.description is distinct from o.description) then
    perform app_task_event(v.id, '課題を編集しました');
  end if;
  -- 完了への遷移は活動履歴にも自動記録（FR-AC2）
  if p ? 'status' and v.status = '完了' and o.status <> '完了' then
    perform app_log_activity(v.company_id, null, 'タスク', v.title, 'task', v.id::text, '完了');
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ===== フォーム取込 → 活動「フォーム」＋ 受信活動のフォロー解消（FR-AC2/AC7） =====
create or replace function import_form_submission(p_id text) returns jsonb language plpgsql as $$
declare s form_submissions; cid text; res jsonb;
begin
  select * into s from form_submissions where id::text = p_id;
  if s.id is null then return jsonb_build_object('error','not found'); end if;
  res := create_company_with_contact(
    jsonb_build_object('type', coalesce(s.payload->>'type','法人'), 'name', s.payload->>'name',
      'industry', s.payload->>'industry', 'area', s.payload->>'area', 'size', s.payload->>'size',
      'needs', coalesce(s.payload->'needs','[]'::jsonb), 'offers', coalesce(s.payload->'offers','[]'::jsonb), 'status', '見込み'),
    jsonb_build_object('name', coalesce(s.payload->>'contact', s.payload->>'name'), 'kana', s.payload->>'kana',
      'email', s.payload->>'email', 'phone', s.payload->>'phone', 'is_primary', true));
  cid := res->>'company_id';
  update form_submissions set status='取込済', matched_company_id = cid::uuid where id::text = p_id;
  -- 受信時の活動（未対応）をフォロー解消し、取込を記録
  update activities set status = '完了' where source_kind = 'form' and source_id = p_id;
  perform app_log_activity(cid::uuid, null, 'フォーム',
    'フォーム回答を顧客として取込: ' || coalesce(s.payload->>'name','(無名)'), 'form_import', s.id::text, '完了');
  return jsonb_build_object('company_id', cid);
end $$;

create or replace function discard_form_submission(p_id text) returns jsonb language sql as $$
  update form_submissions set status='破棄' where id::text = p_id;
  update activities set status = '完了' where source_kind = 'form' and source_id = p_id;
  select jsonb_build_object('ok', true);
$$;

-- ===== 一覧RPC: 名刺活動から担当者詳細へ遷移できるよう contact_id を返す（FR-AC5） =====
create or replace function app_list_activities(p_kind text default null, p_actor text default null, p_period text default 'week', p_limit int default 100) returns jsonb language sql stable as $$
  with today as (select (now() at time zone 'Asia/Tokyo')::date d),
  base as (
    select ac.*, c.name company, ct.name contact_name, coalesce(u.name, ac.actor_label) actor_name
    from activities ac left join companies c on c.id = ac.company_id left join contacts ct on ct.id = ac.contact_id left join app_users u on u.id = ac.actor
    where ac.deleted_at is null
      and (p_kind is null or ac.kind = p_kind)
      and (p_actor is null or u.name = p_actor)
      and (p_period is null or p_period = 'all'
           or (p_period = 'today' and (ac.occurred_at at time zone 'Asia/Tokyo')::date = (select d from today))
           or (p_period = 'week' and (ac.occurred_at at time zone 'Asia/Tokyo')::date >= (select d from today) - 6)
           or (p_period = 'month' and (ac.occurred_at at time zone 'Asia/Tokyo')::date >= date_trunc('month', (select d from today))::date))
  )
  select jsonb_build_object(
    'count', (select count(*) from base),
    'by_kind', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'count', c) order by c desc) from (select kind, count(*) c from base group by kind) z), '[]'::jsonb),
    'follow_up', (select count(*) from base where status = '未対応'),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'company', company, 'company_id', company_id, 'contact', contact_name, 'contact_id', contact_id,
        'kind', kind, 'title', title, 'status', status,
        'actor', actor_name, 'source', source, 'source_kind', source_kind, 'source_id', source_id,
        'when', to_char(occurred_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI'),
        'day', to_char(occurred_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD')
      ) order by occurred_at desc) from (select * from base order by occurred_at desc limit least(coalesce(p_limit, 100), 300)) s), '[]'::jsonb)
  )
$$;

-- ===== 権限 =====
revoke execute on all functions in schema public from public;
grant execute on all functions in schema public to authenticated;
