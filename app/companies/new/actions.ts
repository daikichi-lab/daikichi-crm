'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createCompany, updateCompany } from '@/lib/data/dal';

function parsePayload(form: FormData) {
  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === 'string' ? v : '';
  };
  const parseTags = (k: string): string[] => {
    try { const a = JSON.parse(get(k) || '[]'); return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
  };
  const extra: Record<string, unknown> = {};
  const website = get('website').trim();
  if (website) extra.website = website;
  const sns: Record<string, string> = {};
  for (const [label, key] of [['𝕏 X', 'sns_x'], ['Instagram', 'sns_instagram'], ['Facebook', 'sns_facebook'], ['LINE / その他', 'sns_other']] as const) {
    const v = get(key).trim();
    if (v) sns[label] = v;
  }
  if (Object.keys(sns).length) extra.sns = sns;
  // 任意の追加 extra（extra_keys / extra_vals）
  const keys = form.getAll('extra_key').map(String);
  const vals = form.getAll('extra_val').map(String);
  keys.forEach((k, i) => { if (k.trim()) extra[k.trim()] = vals[i] ?? ''; });

  return {
    type: get('type') || '法人',
    name: get('name').trim(),
    industry: get('industry'),
    area: get('area'),
    size: get('size'),
    status: get('status') || '見込み',
    owner_id: get('owner_id'),
    notes: get('notes'),
    needs: parseTags('needs'),
    offers: parseTags('offers'),
    extra,
  };
}

export async function createCompanyAction(form: FormData) {
  const payload = parsePayload(form);
  const r = await createCompany(payload);
  revalidatePath('/companies');
  if (r && (r as any).id) redirect(`/companies/${(r as any).id}`);
  redirect('/companies');
}

export async function updateCompanyAction(id: string, form: FormData) {
  const payload = parsePayload(form);
  await updateCompany(id, payload);
  revalidatePath('/companies');
  revalidatePath(`/companies/${id}`);
  redirect(`/companies/${id}`);
}
