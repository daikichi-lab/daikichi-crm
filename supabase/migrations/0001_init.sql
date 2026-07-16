-- 大吉CRM — スキーマ（コア＋連携機能）
-- 正典: docs/requirements.md §8 / contract.md。Postgres 16 (PGlite dev/test) と Supabase (prod) 双方で適用可能。
-- enum は admin が運用で増やす項目（業種/タグ/トピック）を避け、構造的な区分のみ CHECK で縛る（C-8 2層構造）。

-- gen_random_uuid() は PG16 コア（pgcrypto 不要）。

-- ===== スタッフ（プロフィール）。Supabase では auth.users.id と一致させる profile パターン。 =====
create table if not exists app_users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text unique not null,
  role          text not null default 'staff' check (role in ('staff','admin')),
  active        boolean not null default true,
  avatar_initial text,
  created_at    timestamptz not null default now()
);

-- ===== マスタ（編集可能なもの＝テーブル化） =====
create table if not exists industries (
  id uuid primary key default gen_random_uuid(),
  label text unique not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  label text unique not null,
  created_at timestamptz not null default now()
);
create table if not exists newsletter_topics (
  id uuid primary key default gen_random_uuid(),
  label text unique not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- ===== companies（顧客企業／事業者） =====
create table if not exists companies (
  id           uuid primary key default gen_random_uuid(),
  type         text not null default '法人' check (type in ('法人','個人事業主')),
  name         text not null,
  industry     text,
  area         text,
  size         text,
  needs        text[] not null default '{}',
  offers       text[] not null default '{}',
  status       text not null default '見込み' check (status in ('顧問中','見込み','休眠')),
  owner_id     uuid references app_users(id) on delete set null,
  notes        text,
  fiscal_month int check (fiscal_month between 1 and 12),
  extra        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index if not exists idx_companies_needs on companies using gin (needs);
create index if not exists idx_companies_offers on companies using gin (offers);
create index if not exists idx_companies_status on companies (status);
create index if not exists idx_companies_deleted on companies (deleted_at);

-- ===== contacts（先方担当者） =====
create table if not exists contacts (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  name        text not null,
  name_kana   text,
  title       text,
  department  text,
  email       text,
  phone       text,
  mobile      text,
  is_primary  boolean not null default false,
  opt_in      boolean not null default true,
  topics      text[] not null default '{}',
  unsubscribe_token text not null default replace(gen_random_uuid()::text,'-',''),
  extra       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists idx_contacts_company on contacts (company_id);
create index if not exists idx_contacts_deleted on contacts (deleted_at);

-- ===== business_cards（名刺＋OCR） =====
create table if not exists business_cards (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references contacts(id) on delete cascade,
  front_path  text,
  back_path   text,
  ocr_status  text not null default '未処理' check (ocr_status in ('未処理','処理中','完了','失敗')),
  ocr_raw     jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_cards_contact on business_cards (contact_id);

-- ===== referrals（紹介履歴） =====
create table if not exists referrals (
  id              uuid primary key default gen_random_uuid(),
  from_company_id uuid not null references companies(id) on delete cascade,
  to_company_id   uuid not null references companies(id) on delete cascade,
  kind            text not null check (kind in ('協業先紹介','顧客紹介')),
  matched_tags    text[] not null default '{}',
  status          text not null default '提案' check (status in ('提案','打診中','成立','不成立')),
  note            text,
  created_by      uuid references app_users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ===== schedule_items（期限・タスク） =====
create table if not exists schedule_items (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  kind       text not null check (kind in ('決算準備','申告・納付','年末調整','手動タスク')),
  title      text not null,
  due_date   date,
  source     text not null default '手動' check (source in ('自動','手動')),
  rule_key   text,
  assignee   uuid references app_users(id) on delete set null,
  status     text not null default '未対応' check (status in ('未対応','対応中','完了')),
  done_at    timestamptz,
  extra      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_sched_due on schedule_items (due_date);
create index if not exists idx_sched_assignee on schedule_items (assignee, status);
create index if not exists idx_sched_company on schedule_items (company_id);
-- 自動生成分の冪等キー（rule_key は会社×ルールで一意）
create unique index if not exists uq_sched_rule on schedule_items (company_id, rule_key) where rule_key is not null;

-- ===== company_documents（資料・ファイル メタ） =====
create table if not exists company_documents (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  category    text not null default 'その他',
  file_name   text not null,
  storage_path text,
  mime_type   text,
  size_bytes  bigint not null default 0,
  uploaded_by uuid references app_users(id) on delete set null,
  extra       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists idx_docs_company_cat on company_documents (company_id, category);
create index if not exists idx_docs_created on company_documents (created_at);

-- ===== activities（活動履歴・タイムライン／監査ログ兼用） =====
create table if not exists activities (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references companies(id) on delete set null,
  contact_id  uuid references contacts(id) on delete set null,
  kind        text not null check (kind in ('電話','面談・訪問','メール','議事録','紹介','メルマガ','フォーム','名刺','資料','タスク','メモ')),
  title       text not null,
  body        text,
  source      text not null default '手動' check (source in ('自動','手動')),
  source_kind text,
  source_id   text,
  status      text check (status in ('未対応','対応中','完了')),
  actor       uuid references app_users(id) on delete set null,
  actor_label text,
  occurred_at timestamptz not null default now(),
  extra       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists idx_act_company_time on activities (company_id, occurred_at desc);
create index if not exists idx_act_kind on activities (kind);
create index if not exists idx_act_actor on activities (actor);
-- 自動記録の冪等（同一ソースイベントを重複記録しない・FR-AC9）
create unique index if not exists uq_act_source on activities (source_kind, source_id) where source_kind is not null and source_id is not null;

-- ===== meetings（Google Calendar 連携・デモ） =====
create table if not exists meetings (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references companies(id) on delete set null,
  title       text not null,
  start_at    timestamptz not null,
  location    text,
  attendees   text[] not null default '{}',
  note_status text not null default '未取込' check (note_status in ('未取込','取込済')),
  created_at  timestamptz not null default now()
);

-- ===== notes（議事録・Notta 連携・デモ） =====
create table if not exists notes (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid references companies(id) on delete set null,
  title        text not null,
  summary      text,
  next_actions text[] not null default '{}',
  full_text    text,
  source       text not null default 'Notta',
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- ===== form_submissions（公開フォーム回答） =====
create table if not exists form_submissions (
  id          uuid primary key default gen_random_uuid(),
  payload     jsonb not null,
  status      text not null default '未対応' check (status in ('未対応','取込済','破棄')),
  matched_company_id uuid references companies(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ===== newsletters（メルマガ配信） =====
create table if not exists newsletters (
  id            uuid primary key default gen_random_uuid(),
  subject       text not null,
  body          text not null default '',
  topic_ids     text[] not null default '{}',
  segment       jsonb not null default '{}'::jsonb,
  status        text not null default '下書き' check (status in ('下書き','送信済')),
  target_count  int not null default 0,
  sent_count    int not null default 0,
  failed_count  int not null default 0,
  skipped_count int not null default 0,
  sent_at       timestamptz,
  created_by    uuid references app_users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create table if not exists newsletter_recipients (
  id            uuid primary key default gen_random_uuid(),
  newsletter_id uuid not null references newsletters(id) on delete cascade,
  contact_id    uuid references contacts(id) on delete set null,
  name          text,
  company       text,
  email         text,
  status        text not null default '送信' check (status in ('送信','失敗','停止スキップ')),
  created_at    timestamptz not null default now()
);
create index if not exists idx_nl_recipients on newsletter_recipients (newsletter_id);

-- updated_at 自動更新トリガ
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['companies','contacts','business_cards','referrals','schedule_items','company_documents','activities']
  loop
    execute format('drop trigger if exists trg_updated_at on %I', t);
    execute format('create trigger trg_updated_at before update on %I for each row execute function set_updated_at()', t);
  end loop;
end $$;
