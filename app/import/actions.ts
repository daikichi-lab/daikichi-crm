'use server';

import { revalidatePath } from 'next/cache';
import { createCompany } from '@/lib/data/dal';

export type ImportRow = {
  type: string;
  name: string;
  industry?: string;
  area?: string;
  size?: string;
  needs: string[];
  offers: string[];
  status?: string;
  notes?: string;
};

export async function importAction(rows: ImportRow[]): Promise<{ ok: number; failed: number; errors: string[] }> {
  let ok = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const r of rows) {
    const res = await createCompany({
      type: r.type,
      name: r.name,
      industry: r.industry,
      area: r.area,
      size: r.size,
      needs: r.needs,
      offers: r.offers,
      status: r.status,
      notes: r.notes,
    });
    if (res && res.id) ok++;
    else {
      failed++;
      if (res && res.error) errors.push(`${r.name}: ${res.error}`);
    }
  }
  revalidatePath('/companies');
  return { ok, failed, errors };
}
