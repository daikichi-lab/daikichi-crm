-- 一覧・取得系RPC（各画面用）。read-only。authenticated のRLS下で動作。

-- 担当者詳細
create or replace function get_contact(p_id text, p_reveal boolean default false) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', ct.id, 'name', ct.name, 'kana', ct.name_kana, 'title', ct.title, 'department', ct.department, 'is_primary', ct.is_primary,
    'email', case when p_reveal then ct.email else app_mask_email(ct.email) end,
    'phone', case when p_reveal then ct.phone else app_mask_phone(ct.phone) end,
    'mobile', case when p_reveal then ct.mobile else app_mask_phone(ct.mobile) end,
    'opt_in', ct.opt_in, 'topics', to_jsonb(ct.topics),
    'company_id', ct.company_id, 'company', co.name,
    'cards', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'front_path', b.front_path, 'back_path', b.back_path, 'ocr_status', b.ocr_status) order by b.created_at) from business_cards b where b.contact_id = ct.id), '[]'::jsonb)
  )
  from contacts ct join companies co on co.id = ct.company_id
  where ct.id::text = p_id and ct.deleted_at is null
$$;

-- 企業詳細サマリ（カウント類）
create or replace function app_company_overview(p_company text) returns jsonb language plpgsql stable as $$
declare c companies;
begin
  select * into c from app_resolve_company(p_company);
  if c.id is null then return jsonb_build_object('error', 'not found'); end if;
  return jsonb_build_object(
    'id', c.id,
    'contacts', (select count(*) from contacts where company_id = c.id and deleted_at is null),
    'cards', (select count(*) from business_cards b join contacts ct on ct.id = b.contact_id where ct.company_id = c.id and ct.deleted_at is null),
    'documents', (select count(*) from company_documents where company_id = c.id and deleted_at is null),
    'documents_size', (select app_fmt_size(coalesce(sum(size_bytes), 0)::bigint) from company_documents where company_id = c.id and deleted_at is null),
    'notes', (select count(*) from notes where company_id = c.id),
    'referrals', (select count(*) from referrals where from_company_id = c.id or to_company_id = c.id),
    'registered', to_char(c.created_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD'),
    'updated', to_char(c.updated_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD'),
    'next_meeting', (select jsonb_build_object('title', title, 'start', to_char(start_at at time zone 'Asia/Tokyo', 'MM/DD HH24:MI'), 'location', location, 'id', id)
                     from meetings where company_id = c.id order by start_at desc limit 1)
  );
end $$;

-- 期限・タスク一覧（バケット付き）
create or replace function app_list_schedule(p_status text default null, p_assignee text default null, p_kind text default null, p_company text default null) returns jsonb language sql stable as $$
  with today as (select (now() at time zone 'Asia/Tokyo')::date d),
  items as (
    select s.*, c.name company, u.name assignee_name,
      case when s.status = '完了' then 'done'
           when s.due_date is null then 'later'
           when s.due_date < (select d from today) then 'overdue'
           when s.due_date < (select d from today) + 7 then 'week'
           when s.due_date < (date_trunc('month', (select d from today)) + interval '1 month')::date then 'month'
           else 'later' end bucket
    from schedule_items s left join companies c on c.id = s.company_id left join app_users u on u.id = s.assignee
    where s.deleted_at is null
      and (p_status is null or s.status = p_status)
      and (p_assignee is null or s.assignee::text = p_assignee or u.name = p_assignee)
      and (p_kind is null or s.kind = p_kind)
      and (p_company is null or s.company_id::text = p_company)
  )
  select jsonb_build_object(
    'count', (select count(*) from items),
    'overdue', (select count(*) from items where bucket = 'overdue'),
    'week', (select count(*) from items where bucket = 'week'),
    'month', (select count(*) from items where bucket = 'month'),
    'open', (select count(*) from items where status <> '完了'),
    'done_total', (select count(*) from items where status = '完了'),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'company', company, 'company_id', company_id, 'kind', kind, 'title', title,
        'due_date', to_char(due_date, 'YYYY-MM-DD'), 'source', source, 'status', status, 'assignee', assignee_name, 'bucket', bucket
      ) order by (due_date is null), due_date) from items), '[]'::jsonb)
  )
$$;

-- 紹介履歴一覧
create or replace function app_list_referrals(p_company text default null, p_status text default null) returns jsonb language sql stable as $$
  with r as (
    select rf.*, f.name from_name, t.name to_name, u.name by_name
    from referrals rf join companies f on f.id = rf.from_company_id join companies t on t.id = rf.to_company_id
    left join app_users u on u.id = rf.created_by
    where (p_status is null or rf.status = p_status)
      and (p_company is null or rf.from_company_id::text = p_company or rf.to_company_id::text = p_company
           or f.name ilike '%' || p_company || '%' or t.name ilike '%' || p_company || '%')
  )
  select jsonb_build_object(
    'count', (select count(*) from r),
    'by_status', coalesce((select jsonb_object_agg(status, c) from (select status, count(*) c from referrals group by status) z), '{}'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'from', from_name, 'from_id', from_company_id, 'to', to_name, 'to_id', to_company_id,
        'kind', kind, 'matched_tags', to_jsonb(matched_tags), 'status', status, 'note', note, 'by', by_name,
        'created_at', to_char(created_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD')
      ) order by created_at desc) from r), '[]'::jsonb)
  )
$$;

-- 活動履歴一覧（横断・タイムライン）
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
        'id', id, 'company', company, 'company_id', company_id, 'contact', contact_name, 'kind', kind, 'title', title, 'status', status,
        'actor', actor_name, 'source', source, 'source_kind', source_kind, 'source_id', source_id,
        'when', to_char(occurred_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI'),
        'day', to_char(occurred_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD')
      ) order by occurred_at desc) from (select * from base order by occurred_at desc limit least(coalesce(p_limit, 100), 300)) s), '[]'::jsonb)
  )
$$;

-- 打ち合わせ一覧
create or replace function app_list_meetings() returns jsonb language sql stable as $$
  select jsonb_build_object('items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', m.id, 'title', m.title, 'company', c.name, 'company_id', m.company_id,
      'start', to_char(m.start_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI'), 'location', m.location,
      'attendees', to_jsonb(m.attendees), 'note_status', m.note_status
    ) order by m.start_at desc) from meetings m left join companies c on c.id = m.company_id), '[]'::jsonb))
$$;

-- 議事録一覧／詳細
create or replace function app_list_notes() returns jsonb language sql stable as $$
  select jsonb_build_object('items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', n.id, 'title', n.title, 'company', c.name, 'company_id', n.company_id, 'summary', n.summary, 'source', n.source,
      'occurred_at', to_char(n.occurred_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI')
    ) order by n.occurred_at desc) from notes n left join companies c on c.id = n.company_id), '[]'::jsonb))
$$;
create or replace function app_get_note(p_id text) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', n.id, 'title', n.title, 'company', c.name, 'company_id', n.company_id, 'summary', n.summary,
    'next_actions', to_jsonb(n.next_actions), 'full_text', n.full_text, 'source', n.source,
    'occurred_at', to_char(n.occurred_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI')
  ) from notes n left join companies c on c.id = n.company_id where n.id::text = p_id
$$;

-- メルマガ一覧／詳細
create or replace function app_list_newsletters() returns jsonb language sql stable as $$
  select jsonb_build_object('items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'subject', subject, 'status', status, 'topic_ids', to_jsonb(topic_ids),
      'target_count', target_count, 'sent_count', sent_count, 'failed_count', failed_count, 'skipped_count', skipped_count,
      'sent_at', to_char(sent_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI'),
      'created_at', to_char(created_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD')
    ) order by coalesce(sent_at, created_at) desc) from newsletters), '[]'::jsonb))
$$;
create or replace function app_get_newsletter(p_id text) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', n.id, 'subject', n.subject, 'body', n.body, 'status', n.status, 'topic_ids', to_jsonb(n.topic_ids),
    'target_count', n.target_count, 'sent_count', n.sent_count, 'failed_count', n.failed_count, 'skipped_count', n.skipped_count,
    'sent_at', to_char(n.sent_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI'),
    'recipients', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'company', company, 'email', app_mask_email(email), 'status', status)) from newsletter_recipients where newsletter_id = n.id), '[]'::jsonb)
  ) from newsletters n where n.id::text = p_id
$$;

-- フォーム回答 受信箱
create or replace function app_list_form_submissions(p_status text default null) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'count', (select count(*) from form_submissions where (p_status is null or status = p_status)),
    'pending', (select count(*) from form_submissions where status = '未対応'),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'payload', payload, 'status', status, 'matched_company_id', matched_company_id,
        'created_at', to_char(created_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI')
      ) order by created_at desc) from form_submissions where (p_status is null or status = p_status)), '[]'::jsonb)
  )
$$;

-- ゴミ箱（論理削除済み）
create or replace function app_list_trash() returns jsonb language sql stable as $$
  select jsonb_build_object(
    'companies', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'type', type, 'deleted_at', to_char(deleted_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI')) order by deleted_at desc) from companies where deleted_at is not null), '[]'::jsonb),
    'contacts', coalesce((select jsonb_agg(jsonb_build_object('id', ct.id, 'name', ct.name, 'company', co.name, 'deleted_at', to_char(ct.deleted_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI')) order by ct.deleted_at desc) from contacts ct left join companies co on co.id = ct.company_id where ct.deleted_at is not null), '[]'::jsonb)
  )
$$;

revoke execute on all functions in schema public from public;
grant execute on all functions in schema public to authenticated;
