-- 書き込みRPC（認可は DAL＋RLS＋関数内 admin チェック）。jsonb 引数 p で複数項目を受ける。

-- 設定（公開フォーム設定など）
create table if not exists app_settings (key text primary key, value jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());
alter table app_settings enable row level security;
drop policy if exists settings_read on app_settings;
create policy settings_read on app_settings for select to authenticated using (true);
drop policy if exists settings_write on app_settings;
create policy settings_write on app_settings for all to authenticated using (true) with check (true);
grant select, insert, update, delete on app_settings to authenticated;

insert into app_settings(key, value) values
  ('public_form', jsonb_build_object(
    'title','事業の「求めてること」「提供できること」を教えてください',
    'intro','いただいた情報は、顧問先・お客様同士のビジネス紹介（協業先・お客様のご紹介）に活用します。送信内容は担当者が確認のうえ登録します。',
    'consent','入力内容を大吉会計事務所が確認・保管することに同意します（個人情報は国内サーバーに保管）。',
    'fields', jsonb_build_array('type','industry','name','contact','kana','email','phone','area','size','needs','offers','sns','message')
  ))
on conflict (key) do nothing;

-- ===== companies =====
create or replace function create_company(p jsonb) returns jsonb language plpgsql as $$
declare v companies;
begin
  if coalesce(p->>'name','') = '' then return jsonb_build_object('error','名称は必須です'); end if;
  insert into companies(type,name,industry,area,size,needs,offers,status,owner_id,notes,fiscal_month,extra)
  values(coalesce(p->>'type','法人'), p->>'name', nullif(p->>'industry',''), nullif(p->>'area',''), nullif(p->>'size',''),
    coalesce((select array(select jsonb_array_elements_text(p->'needs'))), '{}'),
    coalesce((select array(select jsonb_array_elements_text(p->'offers'))), '{}'),
    coalesce(nullif(p->>'status',''),'見込み'), nullif(p->>'owner_id','')::uuid, nullif(p->>'notes',''),
    nullif(p->>'fiscal_month','')::int, coalesce(p->'extra','{}'::jsonb)) returning * into v;
  return jsonb_build_object('id', v.id);
end $$;

create or replace function update_company(p_id text, p jsonb) returns jsonb language plpgsql as $$
begin
  update companies set
    type = case when p ? 'type' then p->>'type' else type end,
    name = case when p ? 'name' then p->>'name' else name end,
    industry = case when p ? 'industry' then nullif(p->>'industry','') else industry end,
    area = case when p ? 'area' then nullif(p->>'area','') else area end,
    size = case when p ? 'size' then nullif(p->>'size','') else size end,
    status = case when p ? 'status' then p->>'status' else status end,
    owner_id = case when p ? 'owner_id' then nullif(p->>'owner_id','')::uuid else owner_id end,
    notes = case when p ? 'notes' then nullif(p->>'notes','') else notes end,
    fiscal_month = case when p ? 'fiscal_month' then nullif(p->>'fiscal_month','')::int else fiscal_month end,
    needs = case when p ? 'needs' then array(select jsonb_array_elements_text(p->'needs')) else needs end,
    offers = case when p ? 'offers' then array(select jsonb_array_elements_text(p->'offers')) else offers end,
    extra = case when p ? 'extra' then p->'extra' else extra end
  where id::text = p_id and deleted_at is null;
  return jsonb_build_object('id', p_id);
end $$;

create or replace function soft_delete_company(p_id text) returns jsonb language sql as $$
  update companies set deleted_at = now() where id::text = p_id and deleted_at is null;
  select jsonb_build_object('ok', true);
$$;
create or replace function restore_company(p_id text) returns jsonb language sql as $$
  update companies set deleted_at = null where id::text = p_id;
  select jsonb_build_object('ok', true);
$$;
create or replace function purge_company(p_id text) returns jsonb language plpgsql as $$
begin
  if not app_is_admin() then return jsonb_build_object('error','forbidden'); end if;
  delete from companies where id::text = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- ===== contacts / business_cards =====
create or replace function create_contact(p_company_id text, p jsonb) returns jsonb language plpgsql as $$
declare v contacts;
begin
  if coalesce(p->>'name','') = '' then return jsonb_build_object('error','氏名は必須です'); end if;
  insert into contacts(company_id,name,name_kana,title,department,email,phone,mobile,is_primary,opt_in,topics)
  values(p_company_id::uuid, p->>'name', nullif(p->>'kana',''), nullif(p->>'title',''), nullif(p->>'department',''),
    nullif(p->>'email',''), nullif(p->>'phone',''), nullif(p->>'mobile',''),
    coalesce((p->>'is_primary')::boolean,false), coalesce((p->>'opt_in')::boolean,true),
    coalesce((select array(select jsonb_array_elements_text(p->'topics'))), '{}')) returning * into v;
  if v.is_primary then update contacts set is_primary=false where company_id=v.company_id and id<>v.id; end if;
  return jsonb_build_object('id', v.id);
end $$;

create or replace function update_contact(p_id text, p jsonb) returns jsonb language plpgsql as $$
begin
  update contacts set
    name = case when p ? 'name' then p->>'name' else name end,
    name_kana = case when p ? 'kana' then nullif(p->>'kana','') else name_kana end,
    title = case when p ? 'title' then nullif(p->>'title','') else title end,
    department = case when p ? 'department' then nullif(p->>'department','') else department end,
    email = case when p ? 'email' then nullif(p->>'email','') else email end,
    phone = case when p ? 'phone' then nullif(p->>'phone','') else phone end,
    mobile = case when p ? 'mobile' then nullif(p->>'mobile','') else mobile end,
    opt_in = case when p ? 'opt_in' then (p->>'opt_in')::boolean else opt_in end,
    topics = case when p ? 'topics' then array(select jsonb_array_elements_text(p->'topics')) else topics end
  where id::text = p_id and deleted_at is null;
  return jsonb_build_object('id', p_id);
end $$;

create or replace function set_primary_contact(p_id text) returns jsonb language plpgsql as $$
declare cid uuid;
begin
  select company_id into cid from contacts where id::text = p_id;
  update contacts set is_primary = (id::text = p_id) where company_id = cid;
  return jsonb_build_object('ok', true);
end $$;
create or replace function soft_delete_contact(p_id text) returns jsonb language sql as $$
  update contacts set deleted_at = now() where id::text = p_id and deleted_at is null;
  select jsonb_build_object('ok', true);
$$;
create or replace function restore_contact(p_id text) returns jsonb language sql as $$
  update contacts set deleted_at = null where id::text = p_id;
  select jsonb_build_object('ok', true);
$$;

create or replace function add_contact_to_company(p_company_id text, p jsonb) returns jsonb language plpgsql as $$
begin
  return create_contact(p_company_id, p);
end $$;

create or replace function create_company_with_contact(p_company jsonb, p_contact jsonb) returns jsonb language plpgsql as $$
declare cres jsonb; cid text; ctres jsonb;
begin
  cres := create_company(p_company);
  if cres ? 'error' then return cres; end if;
  cid := cres->>'id';
  ctres := create_contact(cid, p_contact);
  return jsonb_build_object('company_id', cid, 'contact_id', ctres->>'id');
end $$;

create or replace function detect_duplicate_company(p_name text, p_email text default null) returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'status', status) order by name), '[]'::jsonb)
  from (
    select distinct c.id, c.name, c.status from companies c
    left join contacts ct on ct.company_id = c.id
    where c.deleted_at is null and (
      (p_name is not null and c.name ilike '%' || p_name || '%')
      or (p_email is not null and p_email <> '' and ct.email = p_email)
    ) limit 5
  ) z
$$;

create or replace function upload_business_card(p_contact_id text, p_front text, p_back text default null) returns jsonb language plpgsql as $$
declare v business_cards;
begin
  insert into business_cards(contact_id, front_path, back_path, ocr_status)
  values(p_contact_id::uuid, p_front, p_back, '完了') returning * into v;
  return jsonb_build_object('id', v.id);
end $$;
create or replace function delete_business_card(p_id text) returns jsonb language sql as $$
  delete from business_cards where id::text = p_id;
  select jsonb_build_object('ok', true);
$$;

-- ===== referrals =====
create or replace function create_referral(p jsonb) returns jsonb language plpgsql as $$
declare v referrals;
begin
  insert into referrals(from_company_id, to_company_id, kind, matched_tags, status, note, created_by)
  values((p->>'from_company_id')::uuid, (p->>'to_company_id')::uuid, coalesce(p->>'kind','協業先紹介'),
    coalesce((select array(select jsonb_array_elements_text(p->'matched_tags'))), '{}'),
    coalesce(nullif(p->>'status',''),'提案'), nullif(p->>'note',''), auth.uid()) returning * into v;
  insert into activities(company_id, kind, title, source, source_kind, source_id, status, actor)
  values(v.from_company_id, '紹介',
    '紹介を起票（' || v.kind || '）→ ' || (select name from companies where id = v.to_company_id), '自動', 'referral', v.id::text,
    case v.status when '打診中' then '対応中' else null end, auth.uid())
  on conflict (source_kind, source_id) where source_kind is not null and source_id is not null do nothing;
  return jsonb_build_object('id', v.id);
end $$;
create or replace function update_referral_status(p_id text, p_status text) returns jsonb language sql as $$
  update referrals set status = p_status where id::text = p_id;
  select jsonb_build_object('ok', true);
$$;

-- ===== schedule =====
create or replace function create_task(p jsonb) returns jsonb language plpgsql as $$
declare v schedule_items;
begin
  if coalesce(p->>'title','') = '' then return jsonb_build_object('error','内容は必須です'); end if;
  insert into schedule_items(company_id, kind, title, due_date, source, assignee, status)
  values(nullif(p->>'company_id','')::uuid, coalesce(nullif(p->>'kind',''),'手動タスク'), p->>'title',
    nullif(p->>'due_date','')::date, '手動', nullif(p->>'assignee','')::uuid, coalesce(nullif(p->>'status',''),'未対応'))
  returning * into v;
  return jsonb_build_object('id', v.id);
end $$;
create or replace function update_schedule_item(p_id text, p jsonb) returns jsonb language plpgsql as $$
begin
  update schedule_items set
    title = case when p ? 'title' and source='手動' then p->>'title' else title end,
    due_date = case when p ? 'due_date' and source='手動' then nullif(p->>'due_date','')::date else due_date end,
    assignee = case when p ? 'assignee' then nullif(p->>'assignee','')::uuid else assignee end,
    status = case when p ? 'status' then p->>'status' else status end,
    done_at = case when p ? 'status' and p->>'status'='完了' then now() when p ? 'status' then null else done_at end
  where id::text = p_id and deleted_at is null;
  return jsonb_build_object('ok', true);
end $$;
create or replace function complete_schedule_item(p_id text) returns jsonb language sql as $$
  update schedule_items set status='完了', done_at=now() where id::text = p_id;
  select jsonb_build_object('ok', true);
$$;
-- 決算月から税務期限を冪等生成（rule_key で重複防止）。デモ用の最小ルール。
create or replace function regenerate_auto_schedule(p_company text default null) returns jsonb language plpgsql as $$
declare r record; n int := 0; yr int := extract(year from now())::int;
begin
  for r in select * from companies where deleted_at is null and fiscal_month is not null
           and (p_company is null or id::text = p_company) loop
    -- 申告期限: 決算月末の2ヶ月後
    insert into schedule_items(company_id, kind, title, due_date, source, rule_key, status)
    values(r.id, '申告・納付', '法人税・消費税 確定申告',
      (make_date(yr, r.fiscal_month, 1) + interval '1 month - 1 day' + interval '2 months')::date, '自動', 'houjin_shinkoku', '未対応')
    on conflict (company_id, rule_key) where rule_key is not null do update set due_date = excluded.due_date;
    -- 決算準備: 決算月の3ヶ月前
    insert into schedule_items(company_id, kind, title, due_date, source, rule_key, status)
    values(r.id, '決算準備', '決算準備リマインド',
      (make_date(yr, r.fiscal_month, 1) - interval '3 months')::date, '自動', 'kessan_prep', '未対応')
    on conflict (company_id, rule_key) where rule_key is not null do update set due_date = excluded.due_date;
    n := n + 2;
  end loop;
  return jsonb_build_object('generated', n);
end $$;

-- ===== activities（手動記録） =====
create or replace function record_activity(p jsonb) returns jsonb language plpgsql as $$
declare v activities;
begin
  if coalesce(p->>'kind','')='' or coalesce(p->>'title','')='' then return jsonb_build_object('error','種別と内容は必須です'); end if;
  insert into activities(company_id, contact_id, kind, title, body, source, actor)
  values(nullif(p->>'company_id','')::uuid, nullif(p->>'contact_id','')::uuid, p->>'kind', p->>'title', nullif(p->>'body',''), '手動', auth.uid())
  returning * into v;
  return jsonb_build_object('id', v.id);
end $$;

-- ===== tags / masters =====
create or replace function add_tag(p_label text) returns jsonb language sql as $$
  insert into tags(label) values(p_label) on conflict (label) do nothing;
  select jsonb_build_object('ok', true);
$$;
create or replace function add_tag_to_company(p_company_id text, p_tag text, p_side text) returns jsonb language plpgsql as $$
begin
  insert into tags(label) values(p_tag) on conflict (label) do nothing;
  if p_side = 'offer' then
    update companies set offers = (select array(select distinct e from unnest(offers || array[p_tag]) e)) where id::text = p_company_id;
  else
    update companies set needs = (select array(select distinct e from unnest(needs || array[p_tag]) e)) where id::text = p_company_id;
  end if;
  return jsonb_build_object('ok', true);
end $$;
create or replace function rename_tag(p_from text, p_to text) returns jsonb language plpgsql as $$
begin
  if not app_is_admin() then return jsonb_build_object('error','forbidden'); end if;
  update tags set label = p_to where label = p_from;
  update companies set needs = array_replace(needs, p_from, p_to), offers = array_replace(offers, p_from, p_to);
  return jsonb_build_object('ok', true);
end $$;
create or replace function merge_tags(p_from text, p_to text) returns jsonb language plpgsql as $$
begin
  if not app_is_admin() then return jsonb_build_object('error','forbidden'); end if;
  update companies set needs = (select array(select distinct e from unnest(array_replace(needs, p_from, p_to)) e)),
                       offers = (select array(select distinct e from unnest(array_replace(offers, p_from, p_to)) e));
  delete from tags where label = p_from;
  insert into tags(label) values(p_to) on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;
create or replace function add_industry(p_label text) returns jsonb language plpgsql as $$
begin
  if not app_is_admin() then return jsonb_build_object('error','forbidden'); end if;
  insert into industries(label, sort) values(p_label, (select coalesce(max(sort),0)+1 from industries)) on conflict (label) do nothing;
  return jsonb_build_object('ok', true);
end $$;
create or replace function add_newsletter_topic(p_label text) returns jsonb language plpgsql as $$
begin
  if not app_is_admin() then return jsonb_build_object('error','forbidden'); end if;
  insert into newsletter_topics(label, sort) values(p_label, (select coalesce(max(sort),0)+1 from newsletter_topics)) on conflict (label) do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- ===== newsletters =====
create or replace function save_newsletter_draft(p jsonb) returns jsonb language plpgsql as $$
declare v newsletters;
begin
  if p ? 'id' and nullif(p->>'id','') is not null then
    update newsletters set subject = coalesce(p->>'subject',subject), body = coalesce(p->>'body',body),
      topic_ids = case when p ? 'topic_ids' then array(select jsonb_array_elements_text(p->'topic_ids')) else topic_ids end,
      segment = coalesce(p->'segment', segment)
    where id::text = p->>'id' and status = '下書き' returning * into v;
    return jsonb_build_object('id', coalesce(v.id::text, p->>'id'));
  end if;
  insert into newsletters(subject, body, topic_ids, segment, created_by)
  values(coalesce(p->>'subject','(無題)'), coalesce(p->>'body',''),
    coalesce((select array(select jsonb_array_elements_text(p->'topic_ids'))), '{}'), coalesce(p->'segment','{}'::jsonb), auth.uid())
  returning * into v;
  return jsonb_build_object('id', v.id);
end $$;

create or replace function send_newsletter(p jsonb) returns jsonb language plpgsql as $$
declare nid uuid; topics text[]; seg jsonb; sent int:=0; skipped int:=0; r record;
begin
  if p ? 'id' and nullif(p->>'id','') is not null then nid := (p->>'id')::uuid;
  else
    insert into newsletters(subject, body, topic_ids, segment, created_by)
    values(coalesce(p->>'subject','(無題)'), coalesce(p->>'body',''),
      coalesce((select array(select jsonb_array_elements_text(p->'topic_ids'))), '{}'), coalesce(p->'segment','{}'::jsonb), auth.uid())
    returning id into nid;
  end if;
  select topic_ids, segment into topics, seg from newsletters where id = nid;
  delete from newsletter_recipients where newsletter_id = nid;
  for r in
    select ct.id, ct.name, co.name company, ct.email, ct.opt_in, ct.topics
    from contacts ct join companies co on co.id = ct.company_id
    where ct.deleted_at is null and co.deleted_at is null
      and (seg->>'status' is null or co.status = seg->>'status')
      and (seg->>'industry' is null or co.industry = seg->>'industry')
      and (seg->>'area' is null or co.area = seg->>'area')
  loop
    if r.opt_in and (cardinality(topics)=0 or r.topics && topics) then
      insert into newsletter_recipients(newsletter_id, contact_id, name, company, email, status) values(nid, r.id, r.name, r.company, r.email, '送信');
      sent := sent + 1;
    else
      insert into newsletter_recipients(newsletter_id, contact_id, name, company, email, status) values(nid, r.id, r.name, r.company, r.email, '停止スキップ');
      skipped := skipped + 1;
    end if;
  end loop;
  update newsletters set status='送信済', sent_at=now(), target_count=sent+skipped, sent_count=sent, failed_count=0, skipped_count=skipped where id = nid;
  insert into activities(kind, title, source, source_kind, source_id, actor)
  values('メルマガ', '配信「' || (select subject from newsletters where id=nid) || '」対象' || (sent+skipped) || '名（送信' || sent || ' / 停止スキップ' || skipped || '）',
    '自動', 'newsletter', nid::text, auth.uid())
  on conflict (source_kind, source_id) where source_kind is not null and source_id is not null do nothing;
  return jsonb_build_object('id', nid, 'target', sent+skipped, 'sent', sent, 'skipped', skipped);
end $$;

create or replace function duplicate_newsletter(p_id text) returns jsonb language plpgsql as $$
declare v newsletters;
begin
  insert into newsletters(subject, body, topic_ids, segment, created_by)
  select subject || '（複製）', body, topic_ids, segment, auth.uid() from newsletters where id::text = p_id returning * into v;
  return jsonb_build_object('id', v.id);
end $$;

-- ===== forms（公開＝anon, 取込＝authenticated） =====
create or replace function submit_public_form(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare v form_submissions;
begin
  insert into form_submissions(payload, status) values(p, '未対応') returning * into v;
  insert into activities(kind, title, source, source_kind, source_id, status, actor_label)
  values('フォーム', '公開フォームから新規問い合わせを受信（未取込）: ' || coalesce(p->>'name','(無名)'), '自動', 'form', v.id::text, '未対応', 'システム')
  on conflict (source_kind, source_id) where source_kind is not null and source_id is not null do nothing;
  return jsonb_build_object('ok', true);
end $$;

create or replace function get_public_form_config() returns jsonb language sql stable security definer set search_path = public as $$
  select value from app_settings where key = 'public_form'
$$;
create or replace function update_form_config(p jsonb) returns jsonb language sql as $$
  insert into app_settings(key, value, updated_at) values('public_form', p, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  select jsonb_build_object('ok', true);
$$;

create or replace function import_form_submission(p_id text) returns jsonb language plpgsql as $$
declare s form_submissions; cid text; res jsonb;
begin
  select * into s from form_submissions where id::text = p_id;
  if s.id is null then return jsonb_build_object('error','not found'); end if;
  res := create_company_with_contact(
    jsonb_build_object('type', coalesce(s.payload->>'type','法人'), 'name', s.payload->>'name',
      'industry', s.payload->>'industry', 'area', s.payload->>'area', 'size', s.payload->>'size',
      'needs', coalesce(s.payload->'needs','[]'::jsonb), 'offers', coalesce(s.payload->'offers','[]'::jsonb), 'status', '見込み'),
    jsonb_build_object('name', coalesce(s.payload->>'contact', s.payload->>'name'), 'kana', s.payload->>'kana',
      'email', s.payload->>'email', 'phone', s.payload->>'phone', 'is_primary', true));
  cid := res->>'company_id';
  update form_submissions set status='取込済', matched_company_id = cid::uuid where id::text = p_id;
  return jsonb_build_object('company_id', cid);
end $$;
create or replace function discard_form_submission(p_id text) returns jsonb language sql as $$
  update form_submissions set status='破棄' where id::text = p_id;
  select jsonb_build_object('ok', true);
$$;

-- ===== notes =====
create or replace function update_note_todos(p_id text, p_todos jsonb) returns jsonb language sql as $$
  update notes set next_actions = array(select jsonb_array_elements_text(p_todos)) where id::text = p_id;
  select jsonb_build_object('ok', true);
$$;

-- ===== unsubscribe（公開・token） =====
create or replace function get_subscription_by_token(p_token text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('name', name, 'company', (select name from companies where id = c.company_id), 'opt_in', opt_in, 'topics', to_jsonb(topics))
  from contacts c where unsubscribe_token = p_token and deleted_at is null
$$;
create or replace function update_subscription(p_token text, p_topics jsonb) returns jsonb language sql security definer set search_path = public as $$
  update contacts set topics = array(select jsonb_array_elements_text(p_topics)) where unsubscribe_token = p_token;
  select jsonb_build_object('ok', true);
$$;
create or replace function unsubscribe_all(p_token text) returns jsonb language sql security definer set search_path = public as $$
  update contacts set opt_in = false, topics = '{}' where unsubscribe_token = p_token;
  select jsonb_build_object('ok', true);
$$;

-- ===== 権限 =====
revoke execute on all functions in schema public from public;
grant execute on all functions in schema public to authenticated;
-- 公開（anon）が呼べる関数のみ明示付与（security definer）
grant execute on function submit_public_form(jsonb) to anon;
grant execute on function get_public_form_config() to anon;
grant execute on function get_subscription_by_token(text) to anon;
grant execute on function update_subscription(text, jsonb) to anon;
grant execute on function unsubscribe_all(text) to anon;
