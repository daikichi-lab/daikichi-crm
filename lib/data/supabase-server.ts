import 'server-only';
import { cookies } from 'next/headers';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Ctx } from './db';

// 本番 Supabase クライアント（ユーザーのアクセストークンで RLS を効かせる）。
// 注: 完全な Supabase Auth 連携（@supabase/ssr によるトークン更新）は本番化時に差し替える。
export async function getSupabaseForCtx(_ctx: Ctx): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Supabase env (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY) が未設定です');
  const c = await cookies();
  const token = c.get('sb-access-token')?.value;
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  });
}
