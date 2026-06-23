-- 機能RPC（ダッシュボード集計など。以降も追加）。

create or replace function app_dashboard() returns jsonb language sql stable as $$
  with today as (select (now() at time zone 'Asia/Tokyo')::date d)
  select jsonb_build_object(
    'companies_total', (select count(*) from companies where deleted_at is null),
    'advisory',  (select count(*) from companies where deleted_at is null and status='顧問中'),
    'prospect',  (select count(*) from companies where deleted_at is null and status='見込み'),
    'dormant',   (select count(*) from companies where deleted_at is null and status='休眠'),
    'contacts_total', (select count(*) from contacts where deleted_at is null),
    'cards_total', (select count(*) from business_cards),
    'overdue',   (select count(*) from schedule_items s, today where s.deleted_at is null and s.status<>'完了' and s.due_date < today.d),
    'this_week', (select count(*) from schedule_items s, today where s.deleted_at is null and s.status<>'完了' and s.due_date >= today.d and s.due_date < today.d + 7),
    'open_tasks',(select count(*) from schedule_items where deleted_at is null and status<>'完了'),
    'forms_pending', (select count(*) from form_submissions where status='未対応'),
    'referrals_followup', (select count(*) from referrals where status='打診中'),
    'cards_missing', (select count(*) from contacts ct where ct.deleted_at is null and not exists (select 1 from business_cards b where b.contact_id=ct.id)),
    'by_type', coalesce((select jsonb_object_agg(type, c) from (select type, count(*) c from companies where deleted_at is null group by type) z), '{}'::jsonb),
    'by_type_status', coalesce((select jsonb_agg(jsonb_build_object('type',type,'status',status,'count',c)) from (select type,status,count(*) c from companies where deleted_at is null group by type,status) z), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(jsonb_build_object(
        'id',id,'name',name,'industry',industry,'area',area,'status',status,
        'owner',(select name from app_users where id=owner_id),
        'updated_at', to_char(updated_at at time zone 'Asia/Tokyo','YYYY-MM-DD')
      ) order by updated_at desc) from (select * from companies where deleted_at is null order by updated_at desc limit 5) r), '[]'::jsonb)
  )
$$;

revoke execute on all functions in schema public from public;
grant execute on all functions in schema public to authenticated;
