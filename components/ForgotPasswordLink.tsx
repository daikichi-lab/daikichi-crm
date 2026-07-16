'use client';
import { useState } from 'react';

export function ForgotPasswordLink() {
  const [sent, setSent] = useState(false);
  return (
    <>
      <a href="#" onClick={(e) => { e.preventDefault(); setSent(true); }}>
        パスワードを忘れた方
      </a>
      {sent && (
        <div className="toast" role="status">
          <span className="ok">✓</span>
          <span>リセットメールを送信しました</span>
        </div>
      )}
    </>
  );
}
