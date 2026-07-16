import Link from 'next/link';

const STATUS_CLASS: Record<string, string> = { 顧問中: 'active', 見込み: 'prospect', 休眠: 'dormant' };

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STATUS_CLASS[status] ?? ''}`}>
      <span className="dot" />
      {status}
    </span>
  );
}

export function TypeBadge({ type }: { type: string }) {
  return <span className="badge" style={{ background: 'var(--surface-3)', color: 'var(--ink-2)' }}>{type === '法人' ? '法人' : '個人'}</span>;
}

export function TagChip({ label, kind }: { label: string; kind: 'need' | 'offer' }) {
  return (
    <span className={`chip ${kind}`}>
      <span className="mk">{kind === 'need' ? '求' : '提'}</span>
      {label}
    </span>
  );
}

export function TagChips({ needs = [], offers = [] }: { needs?: string[]; offers?: string[] }) {
  return (
    <div className="chips">
      {needs.map((t) => <TagChip key={'n' + t} label={t} kind="need" />)}
      {offers.map((t) => <TagChip key={'o' + t} label={t} kind="offer" />)}
    </div>
  );
}

const SEAL_COLORS = ['#1b4d72', '#2f8056', '#b7861f', '#7a3e8e', '#c0392f', '#2e78b0'];
export function Seal({ name, id }: { name: string; id?: string }) {
  const ch = (name || '？').trim().charAt(0);
  const idx = (id ? id.charCodeAt(id.length - 1) : ch.charCodeAt(0)) % SEAL_COLORS.length;
  return (
    <span className="seal" style={{ background: SEAL_COLORS[idx], color: '#fff', width: 30, height: 30, fontSize: 14, borderRadius: 8, display: 'inline-grid', placeItems: 'center', fontWeight: 700, flex: 'none' }}>
      {ch}
    </span>
  );
}

/** topbar 右端のユーザーアバター（クリックでアカウントへ） */
export function UserAvatar({ initial }: { initial: string }) {
  return (
    <Link href="/account" className="user" aria-label="アカウント">
      <div className="avatar">{initial}</div>
    </Link>
  );
}
