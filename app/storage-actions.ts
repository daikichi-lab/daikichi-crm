'use server';
// 署名URL発行・資料削除のサーバーアクション（閲覧/DLは常に署名URL経由＝SEC-12）。
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/session';
import { getDocument, deleteDocument } from '@/lib/data/dal';
import { DOCS_BUCKET, CARDS_BUCKET, signedUrl } from '@/lib/data/storage';

/** 資料の署名URL（既定120秒）。id からパスを引いて発行。 */
export async function documentSignedUrlAction(id: string): Promise<{ url?: string; file_name?: string; error?: string }> {
  if (!(await getCurrentUser())) return { error: 'unauthorized' };
  const doc = await getDocument(id);
  if (!doc || doc.error) return { error: 'not found' };
  const url = await signedUrl(DOCS_BUCKET, doc.storage_path, 120);
  return { url: url ?? undefined, file_name: doc.file_name };
}

/** 名刺画像の署名URL（保存済みパスから直接発行）。 */
export async function cardSignedUrlAction(path: string | null | undefined): Promise<{ url?: string }> {
  if (!(await getCurrentUser())) return {};
  const url = await signedUrl(CARDS_BUCKET, path, 120);
  return { url: url ?? undefined };
}

/** 名刺の登録/差し替え（Storage アップロード後のパスを business_cards に保存）。 */
export async function uploadBusinessCardAction(contactId: string, path: string, companyId?: string): Promise<{ id?: string; error?: string }> {
  if (!(await getCurrentUser())) return { error: 'unauthorized' };
  const { uploadBusinessCard } = await import('@/lib/data/dal');
  const r = await uploadBusinessCard(contactId, path);
  revalidatePath(`/contacts/${contactId}`);
  if (companyId) revalidatePath(`/companies/${companyId}`);
  return r;
}

/** 資料の削除（論理削除＋実体掃除）。 */
export async function deleteDocumentAction(id: string, companyId?: string): Promise<{ ok?: boolean; error?: string }> {
  if (!(await getCurrentUser())) return { error: 'unauthorized' };
  const r = await deleteDocument(id);
  // 実体掃除はベストエフォート（メタは既に外れている）
  if (r?.storage_path) {
    const { deleteFiles } = await import('@/lib/data/storage');
    await deleteFiles(DOCS_BUCKET, [r.storage_path]);
  }
  revalidatePath('/documents');
  if (companyId) revalidatePath(`/companies/${companyId}`);
  return { ok: true };
}
