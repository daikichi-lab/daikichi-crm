-- アプリRPC: ユーザー/プロフィール（auth・account・admin-users）。以降の機能RPCもこの系列に追加。

create or replace function app_get_user(p_id text) returns jsonb language sql stable as $$
  select jsonb_build_object('id', id, 'name', name, 'email', email, 'role', role, 'active', active, 'avatar_initial', avatar_initial)
  from app_users where id::text = p_id
$$;

-- dev ログイン用（メールでユーザー解決。パスワード検証は dev では省略、prod は Supabase Auth）。
create or replace function app_find_user_by_email(p_email text) returns jsonb language sql stable as $$
  select jsonb_build_object('id', id, 'name', name, 'email', email, 'role', role, 'active', active, 'avatar_initial', avatar_initial)
  from app_users where lower(email) = lower(p_email) and active
$$;

create or replace function app_list_users() returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'email', email, 'role', role, 'active', active, 'avatar_initial', avatar_initial
  ) order by created_at), '[]'::jsonb) from app_users
$$;

-- 自プロフィール更新（表示名のみ・本人）
create or replace function app_update_my_profile(p_name text) returns jsonb language plpgsql as $$
declare u app_users;
begin
  update app_users set name = coalesce(nullif(p_name,''), name) where id = auth.uid() returning * into u;
  if u.id is null then return jsonb_build_object('error','not authenticated'); end if;
  return jsonb_build_object('id',u.id,'name',u.name,'email',u.email,'role',u.role);
end $$;

-- admin: ユーザーのロール/有効を変更
create or replace function app_set_user_role(p_id text, p_role text) returns jsonb language plpgsql as $$
begin
  if not app_is_admin() then return jsonb_build_object('error','forbidden'); end if;
  if p_role not in ('staff','admin') then return jsonb_build_object('error','invalid role'); end if;
  update app_users set role = p_role where id::text = p_id;
  return jsonb_build_object('ok', true);
end $$;
create or replace function app_set_user_active(p_id text, p_active boolean) returns jsonb language plpgsql as $$
begin
  if not app_is_admin() then return jsonb_build_object('error','forbidden'); end if;
  update app_users set active = p_active where id::text = p_id;
  return jsonb_build_object('ok', true);
end $$;
create or replace function app_invite_user(p_name text, p_email text, p_role text default 'staff') returns jsonb language plpgsql as $$
declare u app_users;
begin
  if not app_is_admin() then return jsonb_build_object('error','forbidden'); end if;
  insert into app_users(name, email, role, avatar_initial)
    values (p_name, p_email, coalesce(p_role,'staff'), left(p_name,1))
  on conflict (email) do nothing returning * into u;
  if u.id is null then return jsonb_build_object('error','既に存在するメールです'); end if;
  return jsonb_build_object('id', u.id, 'name', u.name, 'email', u.email, 'role', u.role);
end $$;

revoke execute on all functions in schema public from public;
grant execute on all functions in schema public to authenticated;
