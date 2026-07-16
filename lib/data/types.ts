// RPC が返す JSON 形（contract.md 準拠）。

export type CompanyType = '法人' | '個人事業主';
export type CompanyStatus = '顧問中' | '見込み' | '休眠';

export type CompanyPublic = {
  id: string;
  name: string;
  type: CompanyType;
  industry: string | null;
  area: string | null;
  size: string | null;
  status: CompanyStatus;
  needs: string[];
  offers: string[];
  owner: string | null;
};

export type ContactView = {
  id: string;
  name: string;
  kana: string | null;
  title: string | null;
  department: string | null;
  is_primary: boolean;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  company?: string;
  company_id?: string;
  status?: CompanyStatus;
};

export type CompanyDetail = CompanyPublic & {
  notes: string | null;
  fiscal_month: number | null;
  extra: Record<string, unknown>;
  contacts: ContactView[];
};

export type SearchCompaniesResult = { count: number; companies: CompanyPublic[] };
export type ListContactsResult = { count: number; contacts: ContactView[] };

export type MatchItem = {
  company_id: string;
  company: string;
  industry: string | null;
  area: string | null;
  status: CompanyStatus;
  score: number;
  kyogyo_tags: string[];
  kokyaku_tags: string[];
  reason: string[];
};
export type FindMatchesResult = { base: string; formula: string; matches: MatchItem[]; error?: string };
export type SuggestMatchesResult = {
  count: number;
  top: { a: string; b: string; score: number; matched_tags: string[] }[];
};

export type TagStat = { label: string; used_in_needs: number; used_in_offers: number };
export type ListTagsResult = { count: number; tags: TagStat[] };

export type Masters = {
  industries: string[];
  newsletter_topics: string[];
  sizes: string[];
  document_categories: string[];
  areas: Record<string, string[]>;
};

export type NewsletterSegment = {
  topic_ids: string[];
  count: number;
  note: string;
  sample: { name: string; company: string; email: string }[];
};

export type DocumentMeta = {
  id: string;
  company: string;
  company_id: string;
  file_name: string;
  category: string;
  size: string;
  uploaded_by: string | null;
  created_at: string;
};
export type SearchDocumentsResult = { count: number; total_size: string; note: string; documents: DocumentMeta[] };

export type TimelineItem = {
  when: string;
  kind: string;
  title: string;
  status: string | null;
  contact: string | null;
  actor: string | null;
  source: string;
  source_kind: string | null;
  source_id: string | null;
};
export type CompanyTimeline = { company: string; count: number; note: string; timeline: TimelineItem[]; error?: string };

export type CompanyFilters = {
  type?: string;
  industry?: string;
  area?: string;
  size?: string;
  status?: string;
  needs?: string;
  offers?: string;
  keyword?: string;
  limit?: number;
};
