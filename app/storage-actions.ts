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

/** 名刺画像の署名URL。クライアントは contactId＋面のみ渡し、パスは**サーバー側で認可済みレコードから解決**する
 *  （IDOR対策: 生のパスを受け取らない）。get_contact は RLS 配下の read。 */
export async function cardSignedUrlAction(contactId: string, face: 'front' | 'back' = 'front'): Promise<{ url?: string }> {
  if (!(await getCurrentUser())) return {};
  const { getContact } = await import('@/lib/data/dal');
  const c = await getContact(contactId, true);
  if (!c || c.error) return {};
  const cards: Array<{ front_path?: string | null; back_path?: string | null }> = c.cards ?? c.business_cards ?? [];
  const path = face === 'back'
    ? (cards.map((x) => x.back_path).find(Boolean) ?? cards.map((x) => x.front_path).find(Boolean))
    : cards.map((x) => x.front_path).find(Boolean);
  const url = await signedUrl(CARDS_BUCKET, path, 120);
  return { url: url ?? undefined };
}

/** 名刺履歴（過去の名刺）の一覧。メタのみ（生パスは返さない）。 */
export async function listContactCardsAction(contactId: string): Promise<{ cards?: Array<{ id: string; ocr_status: string; has_front: boolean; has_back: boolean; created_at: string }>; error?: string }> {
  if (!(await getCurrentUser())) return { error: 'unauthorized' };
  const { listContactCards } = await import('@/lib/data/dal');
  const rows = await listContactCards(contactId);
  return { cards: Array.isArray(rows) ? rows : [] };
}

/** 特定の名刺（cardId）の署名URL。パスはサーバー側で認可済みレコードから解決（IDOR対策）。
 *  cardId が当該 contact の名刺であることを get_contact（RLS配下）で検証してから発行する。 */
export async function cardHistorySignedUrlAction(contactId: string, cardId: string, face: 'front' | 'back' = 'front'): Promise<{ url?: string }> {
  if (!(await getCurrentUser())) return {};
  const { getContact } = await import('@/lib/data/dal');
  const c = await getContact(contactId, true);
  if (!c || c.error) return {};
  const cards: Array<{ id?: string; front_path?: string | null; back_path?: string | null }> = c.cards ?? c.business_cards ?? [];
  const card = cards.find((x) => String(x.id) === String(cardId));
  if (!card) return {}; // 当該 contact の名刺でなければ拒否
  const path = face === 'back' ? card.back_path : card.front_path;
  const url = await signedUrl(CARDS_BUCKET, path, 120);
  return { url: url ?? undefined };
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
