'use server';
import { revalidatePath } from 'next/cache';
import { createReferral } from '@/lib/data/dal';

export async function createReferralAction(
  fromId: string,
  toId: string,
  kind: '協業先紹介' | '顧客紹介',
  matchedTags: string[],
): Promise<{ id?: string; error?: string }> {
  const r = await createReferral({
    from_company_id: fromId,
    to_company_id: toId,
    kind,
    matched_tags: matchedTags,
    status: '提案',
  });
  revalidatePath('/matching');
  revalidatePath('/referrals');
  return r;
}
