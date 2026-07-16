-- 資料（company_documents）のアップロード/削除/署名URL用RPC。
-- 実ファイルは Supabase Storage（非公開バケット company-documents）。テーブルにはパスのみ（SEC-9/12）。
-- search_documents は id を追加（署名URL発行の起点）。storage_path は引き続き返さない（MCP/Claude向けSEC-12）。

-- 登録（Storage アップロード後にメタを保存）。活動「資料」を自動記録（FR-AC2）。
create or replace function create_document(p jsonb) returns jsonb language plpgsql as $$
declare v company_documents;
begin
  if coalesce(p->>'company_id','') = '' or coalesce(p->>'file_name','') = '' or coalesce(p->>'storage_path','') = '' then
    return jsonb_build_object('error', 'company_id / file_name / storage_path は必須です');
  end if;
  insert into company_documents(company_id, category, file_name, storage_path, mime_type, size_bytes, uploaded_by)
  values(
    (p->>'company_id')::uuid, coalesce(nullif(p->>'category',''), 'その他'), p->>'file_name',
    p->>'storage_path', nullif(p->>'mime_type',''), coalesce(nullif(p->>'size_bytes','')::bigint, 0), auth.uid())
  returning * into v;
  perform app_log_activity(v.company_id, null, '資料', v.file_name || ' をアップロード', 'document', v.id::text);
  return jsonb_build_object('id', v.id);
end $$;

-- 論理削除（実体掃除のため storage_path を返す）。
create or replace function delete_document(p_id text) returns jsonb language plpgsql as $$
declare sp text;
begin
  update company_documents set deleted_at = now()
  where id::text = p_id and deleted_at is null returning storage_path into sp;
  return jsonb_build_object('ok', true, 'storage_path', sp);
end $$;

-- 署名URL発行のためのパス取得（authenticated 専用。search_documents は SEC-12 でパスを返さないため別RPC）。
create or replace function app_get_document(p_id text) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', id, 'file_name', file_name, 'storage_path', storage_path, 'mime_type', mime_type,
    'company_id', company_id, 'company', (select name from companies where id = company_documents.company_id)
  )
  from company_documents where id::text = p_id and deleted_at is null
$$;

-- search_documents に id を追加（プレビュー/DL/削除の起点）。storage_path は返さない（SEC-12）。
create or replace function search_documents(
  p_keyword text default null, p_category text default null, p_company text default null, p_limit int default 50
) returns jsonb language sql stable as $$
  with d as (
    select dd.*, co.name company from company_documents dd join companies co on co.id = dd.company_id
    where dd.deleted_at is null and co.deleted_at is null
      and (p_company is null or co.name ilike '%' || p_company || '%' or co.id::text = p_company)
      and (p_category is null or dd.category = p_category)
      and (p_keyword is null or (dd.file_name || ' ' || dd.category || ' ' || co.name) ilike '%' || p_keyword || '%')
  ), lim as (select * from d order by created_at desc limit least(coalesce(p_limit, 50), 200))
  select jsonb_build_object(
    'count', (select count(*) from d),
    'total_size', app_fmt_size((select coalesce(sum(size_bytes), 0)::bigint from d)),
    'note', 'メタデータのみ返却（ファイル本体・署名URLは返さない＝SEC-12）',
    'documents', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'company', company, 'company_id', company_id, 'file_name', file_name, 'category', category,
      'size', app_fmt_size(size_bytes), 'uploaded_by', (select name from app_users where id = uploaded_by),
      'created_at', to_char(created_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD')
    ) order by created_at desc) from lim), '[]'::jsonb)
  )
$$;

revoke execute on all functions in schema public from public;
grant execute on all functions in schema public to authenticated;
