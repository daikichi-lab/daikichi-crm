'use server';
import { revalidatePath } from 'next/cache';
import { updateReferralStatus } from '@/lib/data/dal';

export async function updateReferralStatusAction(id: string, status: string): Promise<{ ok?: boolean; error?: string }> {
  const r = await updateReferralStatus(id, status);
  revalidatePath('/referrals');
  return r;
}
