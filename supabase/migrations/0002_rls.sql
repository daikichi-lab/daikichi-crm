-- RLS（SEC-1/2）: 全テーブルで有効化。authenticated は全操作可（全員で共有）、anon は不可。
-- 公開フォーム回答(form_submissions)のみ anon の INSERT を許可。app_users の変更は admin のみ。

-- 管理者判定（security definer で app_users を参照、RLS再帰を避ける）
create or replace function app_is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_users where id = auth.uid() and role = 'admin' and active)
$$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant insert on form_submissions to anon;

-- 共有データ系: authenticated は全操作可
do $$
declare t text;
begin
  foreach t in array array[
    'companies','contacts','business_cards','tags','industries','newsletter_topics',
    'referrals','schedule_items','company_documents','activities','meetings','notes',
    'newsletters','newsletter_recipients'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists auth_all on %I', t);
    execute format($p$create policy auth_all on %I for all to authenticated using (true) with check (true)$p$, t);
  end loop;
end $$;

-- form_submissions: authenticated 全操作 ＋ anon は INSERT のみ（公開フォーム）
alter table form_submissions enable row level security;
drop policy if exists auth_all on form_submissions;
create policy auth_all on form_submissions for all to authenticated using (true) with check (true);
drop policy if exists anon_insert on form_submissions;
create policy anon_insert on form_submissions for insert to anon with check (true);

-- app_users: authenticated は閲覧可、変更は admin のみ
alter table app_users enable row level security;
drop policy if exists users_select on app_users;
create policy users_select on app_users for select to authenticated using (true);
drop policy if exists users_admin_write on app_users;
create policy users_admin_write on app_users for all to authenticated using (app_is_admin()) with check (app_is_admin());
