-- 期限・タスク v2（Jira/Redmine風）: 親子課題・顧客/所内スコープ・進捗・コメント/変更履歴。
-- 正典: mockups/schedule.html / task-form.html / task-detail.html（設計モック）。
-- 親課題の進捗は保存せず読み取り時に子課題から自動集計する（二重管理を避ける）。

-- ===== schedule_items 拡張 =====
alter table schedule_items add column if not exists parent_id  uuid references schedule_items(id) on delete cascade;
alter table schedule_items add column if not exists scope      text not null default 'client';
alter table schedule_items add column if not exists start_date date;
alter table schedule_items add column if not exists progress   int not null default 0;
alter table schedule_items add column if not exists description text;

alter table schedule_items drop constraint if exists schedule_items_kind_check;
alter table schedule_items add constraint schedule_items_kind_check
  check (kind in ('決算準備','申告・納付','年末調整','手動タスク','所内業務'));
alter table schedule_items drop constraint if exists schedule_items_scope_check;
alter table schedule_items add constraint schedule_items_scope_check check (scope in ('client','internal'));
alter table schedule_items drop constraint if exists schedule_items_progress_check;
alter table schedule_items add constraint schedule_items_progress_check check (progress between 0 and 100);
create index if not exists idx_sched_parent on schedule_items (parent_id);

-- ===== schedule_comments（コメント＋変更履歴イベントを1テーブルで） =====
create table if not exists schedule_comments (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references schedule_items(id) on delete cascade,
  kind         text not null default 'comment' check (kind in ('comment','event')),
  body         text not null,
  author       uuid references app_users(id) on delete set null,
  author_label text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_schedcmt_item on schedule_comments (item_id, created_at);
alter table schedule_comments enable row level security;
drop policy if exists auth_all on schedule_comments;
create policy auth_all on schedule_comments for all to authenticated using (true) with check (true);
grant select, insert, update, delete on schedule_comments to authenticated;

-- 変更履歴イベントの記録（author 不明時は「システム」）
create or replace function app_task_event(p_item uuid, p_body text) returns void language sql as $$
  insert into schedule_comments(item_id, kind, body, author, author_label)
  values (p_item, 'event', p_body, auth.uid(), case when auth.uid() is null then 'システム' end);
$$;

-- 担当の解決: uuid でも氏名でも受ける（旧 create_task は氏名を uuid キャストして落ちていた）
create or replace function app_resolve_user(p text) returns uuid language sql stable as $$
  select case
    when p is null or p = '' then null
    when p ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then p::uuid
    else (select id from app_users where name = p limit 1)
  end
$$;

-- ===== 一覧（4ビュー共用・親子ツリー・進捗自動集計） =====
drop function if exists app_list_schedule(text, text, text, text); -- 旧シグネチャ（オーバーロード曖昧化を防ぐ）
create or replace function app_list_schedule(
  p_status text default null, p_assignee text default null, p_kind text default null,
  p_company text default null, p_scope text default null, p_q text default null
) returns jsonb language sql stable as $$
  with today as (select (now() at time zone 'Asia/Tokyo')::date d),
  base as (
    select s.*, c.name company, u.name assignee_name,
      (select count(*) from schedule_items k where k.parent_id = s.id and k.deleted_at is null) kids
    from schedule_items s
      left join companies c on c.id = s.company_id
      left join app_users u on u.id = s.assignee
    where s.deleted_at is null
  ),
  eff as (
    select b.*,
      case when b.status = '完了' then 100
           when b.kids > 0 then coalesce((select round(avg(case when k.status = '完了' then 100 else k.progress end))::int
                                          from schedule_items k where k.parent_id = b.id and k.deleted_at is null), b.progress)
           else b.progress end eff_progress
    from base b
  ),
  filt as ( -- scope 以外の絞り込み（scopeタブの件数用に scope 抜きで一度確定する）
    select e.*,
      case when e.status = '完了' then 'done'
           when e.due_date is null then 'later'
           when e.due_date < (select d from today) then 'overdue'
           when e.due_date < (select d from today) + 7 then 'week'
           when e.due_date < (date_trunc('month', (select d from today)) + interval '1 month')::date then 'month'
           else 'later' end bucket
    from eff e
    where (p_status is null or case when p_status = 'open' then e.status <> '完了' else e.status = p_status end)
      and (p_assignee is null or e.assignee::text = p_assignee or e.assignee_name = p_assignee)
      and (p_kind is null or e.kind = p_kind)
      and (p_company is null or e.company_id::text = p_company)
      and (p_q is null or p_q = '' or e.title ilike '%' || p_q || '%' or e.company ilike '%' || p_q || '%')
  ),
  items as (select * from filt where (p_scope is null or scope = p_scope))
  select jsonb_build_object(
    'count', (select count(*) from items),
    'parents', (select count(*) from items where kids > 0),
    'children', (select count(*) from items where parent_id is not null),
    'overdue', (select count(*) from items where bucket = 'overdue'),
    'week', (select count(*) from items where bucket = 'week'),
    'week_due', (select count(*) from items where bucket in ('overdue','week') and due_date is not null),
    'month', (select count(*) from items where bucket = 'month'),
    'tax_month', (select count(*) from items, today where kind in ('決算準備','申告・納付','年末調整') and status <> '完了'
                    and due_date >= date_trunc('month', today.d)::date
                    and due_date < (date_trunc('month', today.d) + interval '1 month')::date),
    'open', (select count(*) from items where status <> '完了'),
    'done_month', (select count(*) from items, today where status = '完了'
                    and coalesce(done_at, updated_at) >= date_trunc('month', today.d)),
    'scope_all', (select count(*) from filt),
    'scope_client', (select count(*) from filt where scope = 'client'),
    'scope_internal', (select count(*) from filt where scope = 'internal'),
    'today', to_char((select d from today), 'YYYY-MM-DD'),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'parent_id', parent_id, 'company', company, 'company_id', company_id,
        'kind', kind, 'title', title,
        'due_date', to_char(due_date, 'YYYY-MM-DD'), 'start_date', to_char(start_date, 'YYYY-MM-DD'),
        'source', source, 'status', status, 'assignee', assignee_name, 'assignee_id', assignee,
        'scope', scope, 'progress', eff_progress, 'kids', kids, 'bucket', bucket
      ) order by (due_date is null), due_date, created_at) from items), '[]'::jsonb)
  )
$$;

-- ===== 課題詳細（説明・子課題・コメント・変更履歴） =====
create or replace function app_get_task(p_id text) returns jsonb language plpgsql stable as $$
declare s schedule_items; eff int; kids int;
begin
  select * into s from schedule_items where id::text = p_id and deleted_at is null;
  if s.id is null then return jsonb_build_object('error', 'not found'); end if;
  select count(*) into kids from schedule_items k where k.parent_id = s.id and k.deleted_at is null;
  eff := case when s.status = '完了' then 100
              when kids > 0 then coalesce((select round(avg(case when k.status = '完了' then 100 else k.progress end))::int
                                           from schedule_items k where k.parent_id = s.id and k.deleted_at is null), s.progress)
              else s.progress end;
  return jsonb_build_object(
    'id', s.id, 'title', s.title, 'kind', s.kind, 'scope', s.scope, 'status', s.status, 'source', s.source,
    'progress', eff, 'own_progress', s.progress, 'description', s.description,
    'company', (select name from companies where id = s.company_id), 'company_id', s.company_id,
    'assignee', (select name from app_users where id = s.assignee), 'assignee_id', s.assignee,
    'start_date', to_char(s.start_date, 'YYYY-MM-DD'), 'due_date', to_char(s.due_date, 'YYYY-MM-DD'),
    'created_at', to_char(s.created_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI'),
    'updated_at', to_char(s.updated_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI'),
    'extra', s.extra, 'kids', kids,
    'today', to_char((now() at time zone 'Asia/Tokyo')::date, 'YYYY-MM-DD'),
    'parent', (select jsonb_build_object('id', p.id, 'title', p.title) from schedule_items p where p.id = s.parent_id and p.deleted_at is null),
    'children', coalesce((select jsonb_agg(jsonb_build_object(
        'id', k.id, 'title', k.title, 'kind', k.kind, 'status', k.status,
        'due_date', to_char(k.due_date, 'YYYY-MM-DD'), 'start_date', to_char(k.start_date, 'YYYY-MM-DD'),
        'assignee', (select name from app_users where id = k.assignee),
        'progress', case when k.status = '完了' then 100 else k.progress end
      ) order by (k.due_date is null), k.due_date, k.created_at)
      from schedule_items k where k.parent_id = s.id and k.deleted_at is null), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'body', c.body,
        'author', coalesce(u.name, c.author_label, 'システム'), 'avatar', coalesce(u.avatar_initial, left(coalesce(c.author_label,'シ'),1)),
        'at', to_char(c.created_at at time zone 'Asia/Tokyo', 'MM/DD HH24:MI')
      ) order by c.created_at)
      from schedule_comments c left join app_users u on u.id = c.author
      where c.item_id = s.id and c.kind = 'comment'), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'body', c.body,
        'author', coalesce(u.name, c.author_label, 'システム'),
        'at', to_char(c.created_at at time zone 'Asia/Tokyo', 'MM/DD HH24:MI')
      ) order by c.created_at desc)
      from schedule_comments c left join app_users u on u.id = c.author
      where c.item_id = s.id and c.kind = 'event'), '[]'::jsonb)
  );
end $$;

-- ===== 課題フォーム用の参照（企業/スコープで親課題・議事録・資料を絞る） =====
create or replace function app_task_form_lookup(p_company text default null, p_scope text default 'client')
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'parents', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title) order by (s.due_date is null), s.due_date)
      from schedule_items s
      where s.deleted_at is null and s.parent_id is null and s.status <> '完了' and s.scope = coalesce(p_scope, 'client')
        and (case when coalesce(p_scope,'client') = 'internal' then true else s.company_id::text = p_company end)), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title) order by n.occurred_at desc)
      from (select * from notes n0
            where (case when coalesce(p_scope,'client') = 'internal' then n0.company_id is null else n0.company_id::text = p_company end)
            order by n0.occurred_at desc limit 20) n), '[]'::jsonb),
    'docs', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'title', d.file_name) order by d.created_at desc)
      from (select * from company_documents d0
            where d0.deleted_at is null and coalesce(p_scope,'client') = 'client' and d0.company_id::text = p_company
            order by d0.created_at desc limit 20) d), '[]'::jsonb)
  )
$$;

-- ===== 作成（親課題を指定すると子課題・2階層まで） =====
create or replace function create_task(p jsonb) returns jsonb language plpgsql as $$
declare v schedule_items; par schedule_items; v_scope text; v_kind text;
begin
  if coalesce(p->>'title','') = '' then return jsonb_build_object('error','題名は必須です'); end if;
  if nullif(p->>'parent_id','') is not null then
    select * into par from schedule_items where id::text = p->>'parent_id' and deleted_at is null;
    if par.id is null then return jsonb_build_object('error','親課題が見つかりません'); end if;
    if par.parent_id is not null then return jsonb_build_object('error','子課題の下に子課題は作れません'); end if;
  end if;
  v_scope := coalesce(nullif(p->>'scope',''), par.scope, 'client');
  v_kind  := coalesce(nullif(p->>'kind',''), case when v_scope = 'internal' then '所内業務' else '手動タスク' end);
  insert into schedule_items(company_id, parent_id, scope, kind, title, description, start_date, due_date, source, assignee, status, progress, extra)
  values(
    case when v_scope = 'internal' then null else coalesce(par.company_id, nullif(p->>'company_id','')::uuid) end,
    par.id, v_scope, v_kind, p->>'title', nullif(p->>'description',''),
    nullif(p->>'start_date','')::date, nullif(p->>'due_date','')::date, '手動',
    app_resolve_user(p->>'assignee'), coalesce(nullif(p->>'status',''),'未対応'),
    coalesce(nullif(p->>'progress','')::int, 0), coalesce(p->'extra','{}'::jsonb))
  returning * into v;
  perform app_task_event(v.id, case when par.id is null then '課題を作成しました'
                                    else '子課題として作成（親: ' || par.title || '）' end);
  if par.id is not null then
    perform app_task_event(par.id, '子課題「' || v.title || '」を追加しました');
  end if;
  return jsonb_build_object('id', v.id);
end $$;

-- ===== 更新（状態・担当・期日・進捗などの変更を履歴に残す） =====
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
  return jsonb_build_object('ok', true);
end $$;

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
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ===== 削除（手動のみ・子課題も一緒に論理削除） =====
create or replace function delete_task(p_id text) returns jsonb language plpgsql as $$
declare o schedule_items;
begin
  select * into o from schedule_items where id::text = p_id and deleted_at is null;
  if o.id is null then return jsonb_build_object('error','not found'); end if;
  if o.source <> '手動' then return jsonb_build_object('error','自動生成の期限は削除できません'); end if;
  update schedule_items set deleted_at = now() where deleted_at is null and (id = o.id or parent_id = o.id);
  return jsonb_build_object('ok', true);
end $$;

-- ===== コメント =====
create or replace function add_task_comment(p_id text, p_body text) returns jsonb language plpgsql as $$
declare v schedule_comments;
begin
  if coalesce(p_body,'') = '' then return jsonb_build_object('error','コメントを入力してください'); end if;
  if not exists (select 1 from schedule_items where id::text = p_id and deleted_at is null) then
    return jsonb_build_object('error','not found');
  end if;
  insert into schedule_comments(item_id, kind, body, author) values(p_id::uuid, 'comment', p_body, auth.uid())
  returning * into v;
  return jsonb_build_object('id', v.id);
end $$;

-- ===== 権限 =====
revoke execute on all functions in schema public from public;
grant execute on all functions in schema public to authenticated;
