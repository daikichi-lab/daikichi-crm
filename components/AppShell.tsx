'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Icon } from './icons';
import { UIProvider } from './ui';

type NavItem = { id: string; label: string; href: string; ic: string; count?: string };

// 並び＝業務動線順: 起点(ホーム) → 今日やること(期限・タスク) → 顧客台帳(顧客・会った人)
// → 登録の入口(名刺スキャン) → 保管(資料) → Phase2機能(マッチング・紹介)。
// 連携・収集は入口(打ち合わせ→議事録→フォーム→メルマガ)の後に、全接点の集約=活動履歴で締める。
const NAV: NavItem[] = [
  { id: 'home', label: 'ホーム', href: '/dashboard', ic: 'home' },
  { id: 'schedule', label: '期限・タスク', href: '/schedule', ic: 'clock' },
  { id: 'companies', label: '顧客（企業）', href: '/companies', ic: 'building' },
  { id: 'people', label: '会った人', href: '/people', ic: 'users' },
  { id: 'scan', label: '名刺スキャン', href: '/scan', ic: 'card' },
  { id: 'documents', label: '資料', href: '/documents', ic: 'folder' },
  { id: 'matching', label: 'マッチング', href: '/matching', ic: 'link' },
  { id: 'referrals', label: '紹介', href: '/referrals', ic: 'handshake' },
];
const CONNECT: NavItem[] = [
  { id: 'meetings', label: '打ち合わせ', href: '/meetings', ic: 'calendar' },
  { id: 'notes', label: '議事録', href: '/notes', ic: 'doc' },
  { id: 'forms', label: 'フォーム', href: '/forms/inbox', ic: 'inbox' },
  { id: 'newsletter', label: 'メルマガ', href: '/newsletters', ic: 'mail' },
  { id: 'activities', label: '活動履歴', href: '/activities', ic: 'pulse' },
];
const ADMIN: NavItem[] = [{ id: 'admin', label: '管理', href: '/admin/users', ic: 'gear' }];

function NavLink({ n, active }: { n: NavItem; active?: string }) {
  return (
    <Link href={n.href} className={n.id === active ? 'active' : ''}>
      <Icon name={n.ic} />
      <span>{n.label}</span>
      {n.count && <span className="badge-count num">{n.count}</span>}
    </Link>
  );
}

export function AppShell({
  active,
  topbar,
  children,
  bareContent,
}: {
  active?: string;
  topbar?: ReactNode;
  children: ReactNode;
  bareContent?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <UIProvider>
      <div className="app">
        <aside className={`sidebar${open ? ' open' : ''}`} data-active={active}>
          <div className="brand">
            <span className="seal">大</span>
            <span>
              大吉CRM
              <small>顧客管理・紹介</small>
            </span>
          </div>
          <nav className="nav">
            {NAV.map((n) => (
              <NavLink key={n.id} n={n} active={active} />
            ))}
            <div className="group-label">連携・収集</div>
            {CONNECT.map((n) => (
              <NavLink key={n.id} n={n} active={active} />
            ))}
            <div className="group-label">その他</div>
            <Link href="/trash" className={active === 'trash' ? 'active' : ''}>
              <Icon name="trash" />
              <span>ゴミ箱</span>
            </Link>
            {ADMIN.map((n) => (
              <NavLink key={n.id} n={n} active={active} />
            ))}
            <Link href="/account" className={active === 'account' ? 'active' : ''}>
              <Icon name="user" />
              <span>アカウント</span>
            </Link>
          </nav>
          <div className="foot">大吉会計事務所 / v0.7</div>
        </aside>

        <div className="main">
          <header className="topbar">
            <button className="btn btn-icon hamb" aria-label="メニュー" onClick={() => setOpen((o) => !o)}>
              <Icon name="menu" size={16} />
            </button>
            {topbar}
          </header>
          {bareContent ? children : <div className="content">{children}</div>}
        </div>
      </div>
    </UIProvider>
  );
}
