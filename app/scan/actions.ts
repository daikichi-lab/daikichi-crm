'use server';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/session';
import { detectDuplicateCompany, createCompanyWithContact, addContactToCompany, uploadBusinessCard } from '@/lib/data/dal';
import { CARDS_BUCKET, validateUpload, objectPath, uploadFile } from '@/lib/data/storage';

type ScanContact = {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  is_primary?: boolean;
  extra?: Record<string, unknown>;
};
type ScanCompany = {
  name: string;
  type?: string;
  industry?: string;
  area?: string;
  size?: string;
};

/** 重複候補の検出（社名・メール） */
export async function detectDuplicateAction(name: string, email?: string) {
  return detectDuplicateCompany(name, email);
}

/** 名刺画像の実アップロード（非公開バケット）。検証を通してから投入し、Storageパスを返す。
 *  dev/test(pglite) は擬似ストレージ、本番(supabase) は実投入（SEC-5/9）。 */
export async function uploadScanImageAction(fd: FormData): Promise<{ path?: string; error?: string }> {
  await requireUser();
  const file = fd.get('file');
  if (!(file instanceof File)) return { error: '画像がありません' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const err = validateUpload('card', file.name || 'card.jpg', file.type, bytes.byteLength);
  if (err) return { error: err };
  const rid = crypto.randomUUID();
  const path = objectPath('cards', file.name || 'card.jpg', rid);
  const res = await uploadFile(CARDS_BUCKET, path, bytes, file.type || 'image/jpeg');
  if ('error' in res) return { error: res.error };
  return { path: res.path };
}

/** 新規企業＋担当者を作成（名刺の表/裏パスがあれば紐付け） */
export async function createCompanyWithContactAction(company: ScanCompany, contact: ScanContact, frontCard?: string, backCard?: string) {
  await requireUser();
  const res = await createCompanyWithContact(company, contact);
  const contactId: string | undefined = res?.contact_id ?? res?.contact?.id;
  if (contactId && frontCard) await uploadBusinessCard(contactId, frontCard, backCard);
  revalidatePath('/companies');
  return res as { id?: string; company_id?: string; contact_id?: string; error?: string };
}

/** 既存企業に担当者を追加（名刺の表/裏パスがあれば紐付け） */
export async function addContactToCompanyAction(companyId: string, contact: ScanContact, frontCard?: string, backCard?: string) {
  await requireUser();
  const res = await addContactToCompany(companyId, contact);
  const contactId: string | undefined = res?.id ?? res?.contact_id;
  if (contactId && frontCard) await uploadBusinessCard(contactId, frontCard, backCard);
  revalidatePath(`/companies/${companyId}`);
  return res as { id?: string; error?: string };
}
