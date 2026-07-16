'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type ConfirmOpts = {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm?: () => void | Promise<void>;
};
type UI = {
  toast: (msg: string) => void;
  confirm: (opts: ConfirmOpts) => void;
};

const Ctx = createContext<UI | null>(null);

export function useUI(): UI {
  const c = useContext(Ctx);
  if (!c) throw new Error('useUI must be used within <UIProvider>');
  return c;
}

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const [confirmS, setConfirmS] = useState<ConfirmOpts | null>(null);
  const idRef = useRef(0);

  const toast = useCallback((msg: string) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  const confirm = useCallback((opts: ConfirmOpts) => setConfirmS(opts), []);

  const runConfirm = async () => {
    const opts = confirmS;
    setConfirmS(null);
    if (opts?.onConfirm) await opts.onConfirm();
    toast(`${opts?.confirmLabel || '実行'}しました`);
  };

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}

      {confirmS && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setConfirmS(null)}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="m-head">
              <h3>{confirmS.title}</h3>
            </div>
            <div className="m-body">{confirmS.body}</div>
            <div className="m-foot">
              <button className="btn" onClick={() => setConfirmS(null)}>
                キャンセル
              </button>
              <button
                className={`btn ${confirmS.danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={runConfirm}
              >
                {confirmS.confirmLabel || '実行'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toasts.map((t) => (
        <div className="toast" key={t.id}>
          <span className="ok">✓</span>
          <span>{t.msg}</span>
        </div>
      ))}
    </Ctx.Provider>
  );
}
