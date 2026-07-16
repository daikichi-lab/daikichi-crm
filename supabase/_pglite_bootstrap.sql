-- PGlite (dev/test) 専用ブートストラップ。Supabase が標準で持つプリミティブを再現し、
-- 本番マイグレーション（auth.uid()/anon/authenticated 参照）を**無改変**で適用可能にする。
-- このファイルは Supabase 本番では実行しない（auth スキーマ等は既に存在）。

do $$ begin
  if not exists (select from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;

create schema if not exists auth;

-- Supabase 互換: JWT クレーム(GUC request.jwt.claims)から uid/role を取り出す。
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::json->>'sub', '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', ''), 'anon')
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
