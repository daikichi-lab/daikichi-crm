-- セキュリティ修正: 無効化(active=false)ユーザーのセッション失効。
-- app_get_user はセッション検証（getCurrentUser）専用で、無効ユーザーを解決してはならない。
-- （管理画面の一覧は app_list_users を使い、無効ユーザーも表示する＝こちらは変更しない）
-- 参照: security review 2026-07-15 指摘1（deactivated users retain access）。
create or replace function app_get_user(p_id text) returns jsonb language sql stable as $$
  select jsonb_build_object('id', id, 'name', name, 'email', email, 'role', role, 'active', active, 'avatar_initial', avatar_initial)
  from app_users where id::text = p_id and active
$$;
