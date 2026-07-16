import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Ctx } from './db';

// 管理操作専用クライアント（service_role・RLS貫通）。**サーバー側のみ**・管理者ゲート下でのみ使う（SEC-3）。
// 用途: 管理画面からのユーザー作成（Auth ユーザー＋profile）。本番Workerでは実行時Secretに
// SUPABASE_SERVICE_ROLE_KEY が必要（ビルド変数ではなく Cloudflare の Secret）。
export function supabaseAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL が未設定です');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY が未設定です（Cloudflare の Secret に追加してください）');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// 本番 Supabase クライアント（@supabase/ssr・Cookieでユーザーセッションを管理し RLS を効かせる）。
// getAll/setAll は next/headers の cookie ストアに接続する。Server Component では cookie が読み取り専用の
// ため setAll が throw しうる → try/catch（実際の cookie 更新はサーバーアクション/ルートハンドラ側で行われる）。
export async function supabaseServerClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Supabase env (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY) が未設定です');
  const store = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) store.set(name, value, options);
        } catch {
          /* Server Component からの呼び出し（read-only cookie）。認証状態の更新はアクション/ルート側で反映される。 */
        }
      },
    },
  });
}

// RPC 呼び出し用クライアント。Cookie のセッションを読み込み、リクエストにユーザーJWTを付与する
// （JWTの検証・RLSは PostgREST 側で行われる）。ctx は互換のため受けるが、認可は Cookie の JWT が担う。
export async function getSupabaseForCtx(_ctx: Ctx): Promise<SupabaseClient> {
  const supabase = await supabaseServerClient();
  // storage(cookie) からセッションを初期化し、以降の .rpc() に access_token を載せる（ローカル読み取り）。
  await supabase.auth.getSession();
  return supabase;
}
