-- ユーザーの論理削除（活動履歴等に残る担当名を保持しつつ、一覧・認証から除外）。
-- 無効化(active=false)は「一時停止・再有効化前提」、削除(deleted_at)は「退職等で除外」の使い分け。
alter table app_users add column if not exists deleted_at timestamptz;

-- 一覧: 削除済みも含めて返す（deleted_at付き）。管理画面で「（削除済み）」表示＋復元に使う。
create or replace function app_list_users() returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'email', email, 'role', role, 'active', active,
    'avatar_initial', avatar_initial, 'deleted_at', deleted_at
  ) order by created_at), '[]'::jsonb) from app_users
$$;

-- 認証: 削除済みユーザーはログイン不可（active に加え deleted_at is null）。
create or replace function app_get_user(p_id text) returns jsonb language sql stable as $$
  select jsonb_build_object('id', id, 'name', name, 'email', email, 'role', role, 'active', active, 'avatar_initial', avatar_initial)
  from app_users where id::text = p_id and active and deleted_at is null
$$;
create or replace function app_find_user_by_email(p_email text) returns jsonb language sql stable as $$
  select jsonb_build_object('id', id, 'name', name, 'email', email, 'role', role, 'active', active, 'avatar_initial', avatar_initial)
  from app_users where lower(email) = lower(p_email) and active and deleted_at is null
$$;

-- 論理削除: admin のみ・自分自身は不可・最後の有効管理者は不可（多層防御＋RLS）。
create or replace function app_delete_user(p_id text) returns jsonb language plpgsql as $$
declare v app_users;
begin
  if not app_is_admin() then return jsonb_build_object('error','forbidden'); end if;
  if p_id = auth.uid()::text then return jsonb_build_object('error','自分自身は削除できません'); end if;
  select * into v from app_users where id::text = p_id;
  if not found then return jsonb_build_object('error','ユーザーが見つかりません'); end if;
  if v.role = 'admin' and (
    select count(*) from app_users where role = 'admin' and active and deleted_at is null and id::text <> p_id
  ) = 0 then
    return jsonb_build_object('error','最後の管理者は削除できません');
  end if;
  update app_users set deleted_at = now() where id::text = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- 復元: admin のみ。
create or replace function app_restore_user(p_id text) returns jsonb language plpgsql as $$
begin
  if not app_is_admin() then return jsonb_build_object('error','forbidden'); end if;
  update app_users set deleted_at = null where id::text = p_id;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function app_delete_user(text) to authenticated;
grant execute on function app_restore_user(text) to authenticated;
