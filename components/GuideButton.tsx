'use client';
import type { ReactNode } from 'react';
import { useUI } from './ui';
import { Icon } from './icons';

/** 画面の「使い方」ボタン。AppShell 内（UIProvider配下）で使う。 */
export function GuideButton({ title, children }: { title: string; children: ReactNode }) {
  const { guide } = useUI();
  return (
    <button className="btn btn-sm" onClick={() => guide(title, children)}>
      <Icon name="help" size={15} />
      使い方
    </button>
  );
}
