import 'server-only';
import { callRpc } from './db';
import { requireUser, ctxOf } from '../auth/session';
import type {
  SearchCompaniesResult, CompanyDetail, ListContactsResult, FindMatchesResult,
  SuggestMatchesResult, ListTagsResult, Masters, NewsletterSegment,
  SearchDocumentsResult, CompanyTimeline, CompanyFilters,
} from './types';

async function authedCtx() {
  return ctxOf(await requireUser());
}

// ===== 読み取り（crm-demo MCP と同一ロジックの共有RPC） =====
export async function searchCompanies(f: CompanyFilters = {}): Promise<SearchCompaniesResult> {
  return callRpc('search_companies', {
    p_type: f.type, p_industry: f.industry, p_area: f.area, p_status: f.status, p_size: f.size,
    p_needs: f.needs, p_offers: f.offers, p_keyword: f.keyword, p_limit: f.limit,
  }, await authedCtx());
}

export async function getCompany(idOrName: string, reveal = false): Promise<CompanyDetail | { error: string }> {
  return callRpc('get_company', { p_company: idOrName, p_reveal: reveal }, await authedCtx());
}

export async function listContacts(opts: { keyword?: string; company?: string; primaryOnly?: boolean; reveal?: boolean; limit?: number } = {}): Promise<ListContactsResult> {
  return callRpc('list_contacts', {
    p_keyword: opts.keyword, p_company: opts.company, p_primary_only: opts.primaryOnly,
    p_reveal: opts.reveal, p_limit: opts.limit,
  }, await authedCtx());
}

export async function findMatches(companyIdOrName: string, limit?: number): Promise<FindMatchesResult> {
  return callRpc('find_matches', { p_company: companyIdOrName, p_limit: limit }, await authedCtx());
}

export async function suggestMatches(limit?: number): Promise<SuggestMatchesResult> {
  return callRpc('suggest_matches', { p_limit: limit }, await authedCtx());
}

export async function listTags(): Promise<ListTagsResult> {
  return callRpc('list_tags', {}, await authedCtx());
}

export async function getMasters(): Promise<Masters> {
  return callRpc('get_masters', {}, await authedCtx());
}

export async function getNewsletterSegment(opts: { topics?: string[]; status?: string; industry?: string; area?: string } = {}): Promise<NewsletterSegment> {
  return callRpc('get_newsletter_segment', {
    p_topics: opts.topics, p_status: opts.status, p_industry: opts.industry, p_area: opts.area,
  }, await authedCtx());
}

export async function searchDocuments(opts: { keyword?: string; category?: string; company?: string; limit?: number } = {}): Promise<SearchDocumentsResult> {
  return callRpc('search_documents', {
    p_keyword: opts.keyword, p_category: opts.category, p_company: opts.company, p_limit: opts.limit,
  }, await authedCtx());
}

export async function getCompanyTimeline(companyIdOrName: string, opts: { kind?: string; source?: string; limit?: number } = {}): Promise<CompanyTimeline> {
  return callRpc('get_company_timeline', {
    p_company: companyIdOrName, p_kind: opts.kind, p_source: opts.source, p_limit: opts.limit,
  }, await authedCtx());
}

export type Dashboard = {
  companies_total: number; advisory: number; prospect: number; dormant: number;
  contacts_total: number; cards_total: number; cards_missing: number;
  overdue: number; this_week: number; open_tasks: number; forms_pending: number; referrals_followup: number;
  by_type: Record<string, number>;
  by_type_status: { type: string; status: string; count: number }[];
  recent: { id: string; name: string; industry: string | null; area: string | null; status: string; owner: string | null; updated_at: string }[];
};
export async function getDashboard(): Promise<Dashboard> {
  return callRpc('app_dashboard', {}, await authedCtx());
}

// ===== 一覧・取得（機能画面） =====
type J = Record<string, unknown>;
export async function getContact(id: string, reveal = false): Promise<any> {
  return callRpc('get_contact', { p_id: id, p_reveal: reveal }, await authedCtx());
}
export async function companyOverview(idOrName: string): Promise<any> {
  return callRpc('app_company_overview', { p_company: idOrName }, await authedCtx());
}
export async function listSchedule(f: { status?: string; assignee?: string; kind?: string; company?: string; scope?: string; q?: string } = {}): Promise<any> {
  return callRpc('app_list_schedule', { p_status: f.status, p_assignee: f.assignee, p_kind: f.kind, p_company: f.company, p_scope: f.scope, p_q: f.q }, await authedCtx());
}
export async function listReferrals(f: { company?: string; status?: string } = {}): Promise<any> {
  return callRpc('app_list_referrals', { p_company: f.company, p_status: f.status }, await authedCtx());
}
export async function listActivities(f: { kind?: string; actor?: string; period?: string; limit?: number } = {}): Promise<any> {
  return callRpc('app_list_activities', { p_kind: f.kind, p_actor: f.actor, p_period: f.period ?? 'week', p_limit: f.limit }, await authedCtx());
}
export async function listMeetings(): Promise<any> { return callRpc('app_list_meetings', {}, await authedCtx()); }
export async function listNotes(): Promise<any> { return callRpc('app_list_notes', {}, await authedCtx()); }
export async function getNote(id: string): Promise<any> { return callRpc('app_get_note', { p_id: id }, await authedCtx()); }
export async function listNewsletters(): Promise<any> { return callRpc('app_list_newsletters', {}, await authedCtx()); }
export async function getNewsletter(id: string): Promise<any> { return callRpc('app_get_newsletter', { p_id: id }, await authedCtx()); }
export async function listFormSubmissions(status?: string): Promise<any> { return callRpc('app_list_form_submissions', { p_status: status }, await authedCtx()); }
export async function listTrash(): Promise<any> { return callRpc('app_list_trash', {}, await authedCtx()); }
export async function listUsers(): Promise<any> { return callRpc('app_list_users', {}, await authedCtx()); }
export async function getFormConfig(): Promise<any> { return callRpc('get_public_form_config', {}, await authedCtx()); }

// ===== 書き込み（companies） =====
export async function createCompany(p: J): Promise<{ id?: string; error?: string }> { return callRpc('create_company', { p }, await authedCtx()); }
export async function updateCompany(id: string, p: J): Promise<any> { return callRpc('update_company', { p_id: id, p }, await authedCtx()); }
export async function softDeleteCompany(id: string): Promise<any> { return callRpc('soft_delete_company', { p_id: id }, await authedCtx()); }
export async function restoreCompany(id: string): Promise<any> { return callRpc('restore_company', { p_id: id }, await authedCtx()); }
export async function purgeCompany(id: string): Promise<any> { return callRpc('purge_company', { p_id: id }, await authedCtx()); }

// ===== contacts / cards / scan =====
export async function createContact(companyId: string, p: J): Promise<any> { return callRpc('create_contact', { p_company_id: companyId, p }, await authedCtx()); }
export async function updateContact(id: string, p: J): Promise<any> { return callRpc('update_contact', { p_id: id, p }, await authedCtx()); }
export async function setPrimaryContact(id: string): Promise<any> { return callRpc('set_primary_contact', { p_id: id }, await authedCtx()); }
export async function softDeleteContact(id: string): Promise<any> { return callRpc('soft_delete_contact', { p_id: id }, await authedCtx()); }
export async function restoreContact(id: string): Promise<any> { return callRpc('restore_contact', { p_id: id }, await authedCtx()); }
export async function addContactToCompany(companyId: string, p: J): Promise<any> { return callRpc('add_contact_to_company', { p_company_id: companyId, p }, await authedCtx()); }
export async function createCompanyWithContact(company: J, contact: J): Promise<any> { return callRpc('create_company_with_contact', { p_company: company, p_contact: contact }, await authedCtx()); }
export async function detectDuplicateCompany(name: string, email?: string): Promise<any> { return callRpc('detect_duplicate_company', { p_name: name, p_email: email }, await authedCtx()); }
export async function uploadBusinessCard(contactId: string, front: string, back?: string): Promise<any> { return callRpc('upload_business_card', { p_contact_id: contactId, p_front: front, p_back: back }, await authedCtx()); }
export async function deleteBusinessCard(id: string): Promise<any> { return callRpc('delete_business_card', { p_id: id }, await authedCtx()); }

// ===== referrals =====
export async function createReferral(p: J): Promise<any> { return callRpc('create_referral', { p }, await authedCtx()); }
export async function updateReferralStatus(id: string, status: string): Promise<any> { return callRpc('update_referral_status', { p_id: id, p_status: status }, await authedCtx()); }

// ===== schedule（期限・タスク v2: 親子課題・コメント/履歴） =====
export async function createTask(p: J): Promise<any> { return callRpc('create_task', { p }, await authedCtx()); }
export async function updateScheduleItem(id: string, p: J): Promise<any> { return callRpc('update_schedule_item', { p_id: id, p }, await authedCtx()); }
export async function completeScheduleItem(id: string): Promise<any> { return callRpc('complete_schedule_item', { p_id: id }, await authedCtx()); }
export async function regenerateAutoSchedule(company?: string): Promise<any> { return callRpc('regenerate_auto_schedule', { p_company: company }, await authedCtx()); }
export async function getTask(id: string): Promise<any> { return callRpc('app_get_task', { p_id: id }, await authedCtx()); }
export async function deleteTask(id: string): Promise<any> { return callRpc('delete_task', { p_id: id }, await authedCtx()); }
export async function addTaskComment(id: string, body: string): Promise<any> { return callRpc('add_task_comment', { p_id: id, p_body: body }, await authedCtx()); }
export async function taskFormLookup(company?: string, scope: 'client' | 'internal' = 'client'): Promise<any> { return callRpc('app_task_form_lookup', { p_company: company, p_scope: scope }, await authedCtx()); }

// ===== activities =====
export async function recordActivity(p: J): Promise<any> { return callRpc('record_activity', { p }, await authedCtx()); }

// ===== notes =====
export async function updateNoteTodos(id: string, todos: string[]): Promise<any> { return callRpc('update_note_todos', { p_id: id, p_todos: todos }, await authedCtx()); }

// ===== newsletters =====
export async function saveNewsletterDraft(p: J): Promise<any> { return callRpc('save_newsletter_draft', { p }, await authedCtx()); }
export async function sendNewsletter(p: J): Promise<any> { return callRpc('send_newsletter', { p }, await authedCtx()); }
export async function duplicateNewsletter(id: string): Promise<any> { return callRpc('duplicate_newsletter', { p_id: id }, await authedCtx()); }

// ===== forms =====
export async function importFormSubmission(id: string): Promise<any> { return callRpc('import_form_submission', { p_id: id }, await authedCtx()); }
export async function discardFormSubmission(id: string): Promise<any> { return callRpc('discard_form_submission', { p_id: id }, await authedCtx()); }
export async function updateFormConfig(p: J): Promise<any> { return callRpc('update_form_config', { p }, await authedCtx()); }

// ===== tags / masters / admin =====
export async function addTag(label: string): Promise<any> { return callRpc('add_tag', { p_label: label }, await authedCtx()); }
export async function addTagToCompany(companyId: string, tag: string, side: 'need' | 'offer'): Promise<any> { return callRpc('add_tag_to_company', { p_company_id: companyId, p_tag: tag, p_side: side }, await authedCtx()); }
export async function renameTag(from: string, to: string): Promise<any> { return callRpc('rename_tag', { p_from: from, p_to: to }, await authedCtx()); }
export async function mergeTags(from: string, to: string): Promise<any> { return callRpc('merge_tags', { p_from: from, p_to: to }, await authedCtx()); }
export async function addIndustry(label: string): Promise<any> { return callRpc('add_industry', { p_label: label }, await authedCtx()); }
export async function addNewsletterTopic(label: string): Promise<any> { return callRpc('add_newsletter_topic', { p_label: label }, await authedCtx()); }
export async function inviteUser(name: string, email: string, role = 'staff'): Promise<any> { return callRpc('app_invite_user', { p_name: name, p_email: email, p_role: role }, await authedCtx()); }
export async function setUserRole(id: string, role: string): Promise<any> { return callRpc('app_set_user_role', { p_id: id, p_role: role }, await authedCtx()); }
export async function setUserActive(id: string, active: boolean): Promise<any> { return callRpc('app_set_user_active', { p_id: id, p_active: active }, await authedCtx()); }
export async function updateMyProfile(name: string): Promise<any> { return callRpc('app_update_my_profile', { p_name: name }, await authedCtx()); }

// ===== 公開（anon） =====
const anonCtx = { uid: null, role: 'anon' as const };
export async function submitPublicForm(p: J): Promise<any> { return callRpc('submit_public_form', { p }, anonCtx); }
export async function getPublicFormConfig(): Promise<any> { return callRpc('get_public_form_config', {}, anonCtx); }
export async function getSubscriptionByToken(token: string): Promise<any> { return callRpc('get_subscription_by_token', { p_token: token }, anonCtx); }
export async function updateSubscription(token: string, topics: string[]): Promise<any> { return callRpc('update_subscription', { p_token: token, p_topics: topics }, anonCtx); }
export async function unsubscribeAll(token: string): Promise<any> { return callRpc('unsubscribe_all', { p_token: token }, anonCtx); }
