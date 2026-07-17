-- メルマガ画面のKPI（配信先・配信停止）を実データ化するための集計追加。
-- 従来 get_newsletter_segment は「同意ありの対象人数(count)」のみ返していた。
-- ここに「配信停止(opt_in=false)の全体件数(unsubscribed)」を追加する。
-- 配信画面(app/newsletters/page.tsx)の固定値(180/12)を実データに置き換えるため。
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
    'unsubscribed', (
      select count(*) from contacts ct join companies co on co.id = ct.company_id
      where ct.deleted_at is null and co.deleted_at is null and ct.opt_in = false
    ),
    'note', '同意なし・配信停止は自動除外（本文の下書きはClaudeが作成・ツールはLLMを呼ばない）',
    'sample', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'company', company, 'email', app_mask_email(email)))
      from (select * from base limit 8) s), '[]'::jsonb)
  )
$$;

-- 権限は create or replace で保持されるが、念のため authenticated に付与（冪等）。
grant execute on function get_newsletter_segment(text[], text, text, text) to authenticated;
