import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createDocument, uploadBusinessCard } from '@/lib/data/dal';
import {
  CARDS_BUCKET, DOCS_BUCKET, validateUpload, objectPath, uploadFile, type UploadKind,
} from '@/lib/data/storage';

// 実ファイルのアップロード窓口（multipart）。認証必須・サーバー側で検証してから Storage 投入（SEC-5/9）。
// kind=document: company-documents バケットへ→ create_document でメタ登録。
// kind=card:     business-cards バケットへ→ パスを返す（呼び出し側が upload_business_card で保存）。
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid form data' }, { status: 400 });
  }
  const file = form.get('file');
  const kind = String(form.get('kind') || 'document') as UploadKind;
  if (!(file instanceof File)) return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 });

  const bad = validateUpload(kind, file.name, file.type, file.size);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  // 生成不能を避けるためランダム識別子はサーバーで採番（uuid はDB gen と重複しない用途）。
  const rid = crypto.randomUUID();

  if (kind === 'card') {
    // 名刺: 画像を保存し、business_cards への登録まで**サーバー側で完結**（パスをクライアントに往復させない）。
    const contactId = String(form.get('contact_id') || '');
    if (!contactId) return NextResponse.json({ error: '担当者が指定されていません' }, { status: 400 });
    const path = objectPath(`cards/${contactId}`, file.name, rid);
    const up = await uploadFile(CARDS_BUCKET, path, await file.arrayBuffer(), file.type || 'application/octet-stream');
    if ('error' in up) return NextResponse.json({ error: up.error }, { status: 502 });
    const rec = await uploadBusinessCard(contactId, up.path);
    if (rec?.error) return NextResponse.json({ error: rec.error }, { status: 400 });
    return NextResponse.json({ id: rec?.id });
  }

  // document
  const companyId = String(form.get('company_id') || '');
  const category = String(form.get('category') || 'その他');
  if (!companyId) return NextResponse.json({ error: '企業が指定されていません' }, { status: 400 });
  const path = objectPath(companyId, file.name, rid);
  const up = await uploadFile(DOCS_BUCKET, path, await file.arrayBuffer(), file.type || 'application/octet-stream');
  if ('error' in up) return NextResponse.json({ error: up.error }, { status: 502 });
  const rec = await createDocument({
    company_id: companyId, category, file_name: file.name, storage_path: up.path,
    mime_type: file.type || null, size_bytes: String(file.size),
  });
  if (rec.error) return NextResponse.json({ error: rec.error }, { status: 400 });
  return NextResponse.json({ id: rec.id, path: up.path, file_name: file.name });
}
