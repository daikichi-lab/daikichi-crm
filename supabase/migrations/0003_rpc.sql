-- RPC（検索・マッチング等の単一ロジック＝C-6）。crm-demo MCP と同じ入出力JSONを返す。
-- security invoker（既定）→ 呼び出しロールの RLS が効く。grant は 0002_rls.sql 側。

-- ===== ヘルパ =====
create or replace function app_overlap(a text[], b text[]) returns text[] language sql immutable as $$
  select coalesce(array(select x from unnest(a) x where x = any(b)), array[]::text[])
$$;

create or replace function app_mask_email(e text) returns text language sql immutable as $$
  select case when e is null or e = '' then e
    else left(e, 1) || '***@' || coalesce(nullif(split_part(e, '@', 2), ''), '***') end
$$;

create or replace function app_mask_phone(p text) returns text language plpgsql immutable as $$
declare n int; i int; ch text; out text := '';
begin
  if p is null or p = '' then return p; end if;
  n := length(p);
  for i in 1..n loop
    ch := substr(p, i, 1);
    if ch ~ '[0-9]' and not (i - 1 < 3 or i - 1 >= n - 2) then out := out || '*'; else out := out || ch; end if;
  end loop;
  return out;
end $$;

create or replace function app_fmt_size(bytes bigint) returns text language sql immutable as $$
  select case when coalesce(bytes,0) < 1024*1024
    then (round(coalesce(bytes,0)/1024.0))::bigint::text || ' KB'
    else to_char(bytes/1024.0/1024.0, 'FM999990.0') || ' MB' end
$$;

-- 企業を id / 社名で解決（完全一致→部分一致が1件のみ）。検索系の includes と挙動統一。
create or replace function app_resolve_company(q text) returns companies language sql stable as $$
  with exact as (
    select * from companies where deleted_at is null and (id::text = q or name = q) limit 1
  ), sub as (
    select * from companies where deleted_at is null and name ilike '%' || q || '%'
  )
  select * from exact
  union all
  select * from sub where not exists (select 1 from exact) and (select count(*) from sub) = 1
  limit 1
$$;

-- ===== search_companies =====
create or replace function search_companies(
  p_type text default null, p_industry text default null, p_area text default null,
  p_status text default null, p_needs text default null, p_offers text default null,
  p_keyword text default null, p_limit int default 20
) returns jsonb language sql stable as $$
  with f as (
    select c.*, u.name as owner_name
    from companies c left join app_users u on u.id = c.owner_id
    where c.deleted_at is null
      and (p_type is null or c.type = p_type)
      and (p_industry is null or c.industry = p_industry)
      and (p_area is null or c.area = p_area)
      and (p_status is null or c.status = p_status)
      and (p_needs is null or p_needs = any (c.needs))
      and (p_offers is null or p_offers = any (c.offers))
      and (p_keyword is null or (coalesce(c.name,'') || ' ' || coalesce(c.notes,'')) ilike '%' || p_keyword || '%')
    order by c.name
  ), lim as (select * from f limit least(coalesce(p_limit, 20), 100))
  select jsonb_build_object(
    'count', (select count(*) from f),
    'companies', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'type', type, 'industry', industry, 'area', area, 'size', size,
      'status', status, 'needs', to_jsonb(needs), 'offers', to_jsonb(offers), 'owner', owner_name
    )) from lim), '[]'::jsonb)
  )
$$;

-- ===== get_company =====
create or replace function get_company(p_company text, p_reveal boolean default false) returns jsonb language plpgsql stable as $$
declare c companies; oname text;
begin
  select * into c from app_resolve_company(p_company);
  if c.id is null then return jsonb_build_object('error', '企業が見つかりません: ' || p_company); end if;
  select name into oname from app_users where id = c.owner_id;
  return jsonb_build_object(
    'id', c.id, 'name', c.name, 'type', c.type, 'industry', c.industry, 'area', c.area, 'size', c.size,
    'status', c.status, 'needs', to_jsonb(c.needs), 'offers', to_jsonb(c.offers), 'owner', oname,
    'notes', c.notes, 'fiscal_month', c.fiscal_month, 'extra', c.extra,
    'contacts', coalesce((select jsonb_agg(jsonb_build_object(
        'id', ct.id, 'name', ct.name, 'kana', ct.name_kana, 'title', ct.title, 'department', ct.department,
        'is_primary', ct.is_primary,
        'email', case when p_reveal then ct.email else app_mask_email(ct.email) end,
        'phone', case when p_reveal then ct.phone else app_mask_phone(ct.phone) end,
        'mobile', case when p_reveal then ct.mobile else app_mask_phone(ct.mobile) end
      ) order by ct.is_primary desc, ct.name)
      from contacts ct where ct.company_id = c.id and ct.deleted_at is null), '[]'::jsonb)
  );
end $$;

-- ===== list_contacts =====
create or replace function list_contacts(
  p_keyword text default null, p_company text default null, p_primary_only boolean default false,
  p_reveal boolean default false, p_limit int default 50
) returns jsonb language sql stable as $$
  with f as (
    select ct.*, co.name as company, co.industry, co.area, co.status
    from contacts ct join companies co on co.id = ct.company_id
    where ct.deleted_at is null and co.deleted_at is null
      and (p_company is null or co.name ilike '%' || p_company || '%')
      and (not p_primary_only or ct.is_primary)
      and (p_keyword is null or (coalesce(ct.name,'') || coalesce(ct.name_kana,'') || co.name) ilike '%' || p_keyword || '%')
    order by ct.is_primary desc, ct.name
  ), lim as (select * from f limit least(coalesce(p_limit, 50), 200))
  select jsonb_build_object(
    'count', (select count(*) from f),
    'contacts', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'kana', name_kana, 'title', title, 'department', department, 'is_primary', is_primary,
      'company', company, 'company_id', company_id, 'status', status,
      'email', case when p_reveal then email else app_mask_email(email) end,
      'phone', case when p_reveal then phone else app_mask_phone(phone) end,
      'mobile', case when p_reveal then mobile else app_mask_phone(mobile) end
    )) from lim), '[]'::jsonb)
  )
$$;

-- ===== find_matches =====
create or replace function find_matches(p_company text, p_limit int default 10) returns jsonb language plpgsql stable as $$
declare a companies;
begin
  select * into a from app_resolve_company(p_company);
  if a.id is null then return jsonb_build_object('error', '企業が見つかりません: ' || p_company); end if;
  return jsonb_build_object(
    'base', a.name,
    'formula', 'score = |needs∩相手offers| + |offers∩相手needs|（FR-M3）',
    'matches', coalesce((
      with b as (
        select c.id, c.name, c.industry, c.area, c.status,
          app_overlap(a.needs, c.offers) as collab,
          app_overlap(a.offers, c.needs) as refer
        from companies c where c.deleted_at is null and c.id <> a.id
      ), scored as (
        select *, cardinality(collab) + cardinality(refer) as score from b
      ), pos as (select * from scored where score > 0 order by score desc, name limit least(coalesce(p_limit,10),50))
      select jsonb_agg(jsonb_build_object(
        'company_id', id, 'company', name, 'industry', industry, 'area', area, 'status', status, 'score', score,
        'kyogyo_tags', to_jsonb(collab), 'kokyaku_tags', to_jsonb(refer),
        'reason', to_jsonb(array_remove(array[
          case when cardinality(collab) > 0 then '協業先紹介: ' || a.name || ' の needs「' || array_to_string(collab,'・') || '」を ' || name || ' が提供' end,
          case when cardinality(refer) > 0 then '顧客紹介: ' || a.name || ' の offers「' || array_to_string(refer,'・') || '」を ' || name || ' が必要' end
        ], null))
      )) from pos
    ), '[]'::jsonb)
  );
end $$;

-- ===== suggest_matches =====
create or replace function suggest_matches(p_limit int default 10) returns jsonb language sql stable as $$
  with p as (
    select c1.name a, c2.name b,
      app_overlap(c1.needs, c2.offers) ab, app_overlap(c1.offers, c2.needs) ba
    from companies c1 join companies c2 on c1.id < c2.id
    where c1.deleted_at is null and c2.deleted_at is null
  ), s as (
    select a, b, cardinality(ab) + cardinality(ba) score,
      array(select distinct e from unnest(ab || ba) e) tags from p
  ), pos as (select * from s where score > 0 order by score desc, a, b limit least(coalesce(p_limit,10),50))
  select jsonb_build_object(
    'count', (select count(*) from s where score > 0),
    'top', coalesce((select jsonb_agg(jsonb_build_object('a', a, 'b', b, 'score', score, 'matched_tags', to_jsonb(tags))) from pos), '[]'::jsonb)
  )
$$;

-- ===== list_tags =====
create or replace function list_tags() returns jsonb language sql stable as $$
  with n as (select unnest(needs) label from companies where deleted_at is null),
  o as (select unnest(offers) label from companies where deleted_at is null),
  agg as (
    select label,
      count(*) filter (where src = 'n') as used_in_needs,
      count(*) filter (where src = 'o') as used_in_offers
    from (select label, 'n' src from n union all select label, 'o' src from o) z group by label
  )
  select jsonb_build_object(
    'count', (select count(*) from agg),
    'tags', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'used_in_needs', used_in_needs, 'used_in_offers', used_in_offers)
      order by used_in_needs + used_in_offers desc, label) from agg), '[]'::jsonb)
  )
$$;

-- ===== get_masters =====
create or replace function get_masters() returns jsonb language sql stable as $$
  select jsonb_build_object(
    'industries', coalesce((select jsonb_agg(label order by sort, label) from industries), '[]'::jsonb),
    'newsletter_topics', coalesce((select jsonb_agg(label order by sort, label) from newsletter_topics), '[]'::jsonb),
    'sizes', to_jsonb(array['〜1千万','1千万〜5千万','5千万〜1億','1億〜10億','10億〜','不明']),
    'document_categories', to_jsonb(array['契約書','決算書','商品・サービス資料','提案資料','その他']),
    'areas', jsonb_build_object(
      '北海道・東北', to_jsonb(array['北海道','青森','岩手','宮城','秋田','山形','福島']),
      '関東', to_jsonb(array['茨城','栃木','群馬','埼玉','千葉','東京都','神奈川']),
      '中部', to_jsonb(array['新潟','富山','石川','福井','山梨','長野','岐阜','静岡','愛知']),
      '近畿', to_jsonb(array['三重','滋賀','京都府','大阪府','兵庫','奈良','和歌山']),
      '中国・四国', to_jsonb(array['鳥取','島根','岡山','広島','山口','徳島','香川','愛媛','高知']),
      '九州・沖縄', to_jsonb(array['福岡県','佐賀','長崎','熊本','大分','宮崎','鹿児島','沖縄'])
    )
  )
$$;

-- ===== get_newsletter_segment =====
create or replace function get_newsletter_segment(
  p_topics text[] default null, p_status text default null, p_industry text default null, p_area text default null
) returns jsonb language sql stable as $$
  with base as (
    select ct.name, co.name company, ct.email
    from contacts ct join companies co on co.id = ct.company_id
    where ct.deleted_at is null and co.deleted_at is null and ct.opt_in = true
      and (p_topics is null or cardinality(p_topics) = 0 or ct.topics && p_topics)
      and (p_status is null or co.status = p_status)
      and (p_industry is null or co.industry = p_industry)
      and (p_area is null or co.area = p_area)
  )
  select jsonb_build_object(
    'topic_ids', to_jsonb(coalesce(p_topics, array[]::text[])),
    'count', (select count(*) from base),
    'note', '同意なし・配信停止は自動除外（本文の下書きはClaudeが作成・ツールはLLMを呼ばない）',
    'sample', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'company', company, 'email', app_mask_email(email)))
      from (select * from base limit 8) s), '[]'::jsonb)
  )
$$;

-- ===== search_documents =====
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
      'company', company, 'company_id', company_id, 'file_name', file_name, 'category', category,
      'size', app_fmt_size(size_bytes), 'uploaded_by', (select name from app_users where id = uploaded_by),
      'created_at', to_char(created_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD')
    ) order by created_at desc) from lim), '[]'::jsonb)
  )
$$;

-- ===== get_company_timeline =====
create or replace function get_company_timeline(
  p_company text, p_kind text default null, p_source text default null, p_limit int default 30
) returns jsonb language plpgsql stable as $$
declare a companies;
begin
  select * into a from app_resolve_company(p_company);
  if a.id is null then return jsonb_build_object('error', '企業が見つかりません: ' || p_company); end if;
  return jsonb_build_object(
    'company', a.name,
    'count', (select count(*) from activities ac where ac.deleted_at is null and ac.company_id = a.id
       and (p_kind is null or ac.kind = p_kind) and (p_source is null or ac.source = p_source)),
    'note', '活動の要約のみ返却（議事録全文・名刺・資料の実体や連絡先は返さない＝SEC-13/SEC-X4）',
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object(
        'when', to_char(ac.occurred_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI'), 'kind', ac.kind, 'title', ac.title, 'status', ac.status,
        'contact', ct.name, 'actor', coalesce((select name from app_users where id = ac.actor), ac.actor_label),
        'source', ac.source, 'source_kind', ac.source_kind, 'source_id', ac.source_id
      ) order by ac.occurred_at desc)
      from activities ac left join contacts ct on ct.id = ac.contact_id
      where ac.deleted_at is null and ac.company_id = a.id
        and (p_kind is null or ac.kind = p_kind) and (p_source is null or ac.source = p_source)
      limit least(coalesce(p_limit, 30), 100)
    ), '[]'::jsonb)
  );
end $$;

-- ===== 関数の実行権限（最小権限・SEC-X2）: public から剥奪し authenticated にのみ付与 =====
revoke execute on all functions in schema public from public;
grant execute on all functions in schema public to authenticated;

