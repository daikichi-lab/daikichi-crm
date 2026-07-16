import { describe, it, expect } from 'vitest';
import { esc, renderTemplate } from '../../lib/email';

describe('esc', () => {
  it('escapes HTML-significant characters', () => {
    expect(esc('A&B <x> "q"')).toBe('A&amp;B &lt;x&gt; &quot;q&quot;');
  });
});

describe('renderTemplate', () => {
  it('本文(既定)は差し込み値をHTMLエスケープする', () => {
    const out = renderTemplate('こんにちは {{会社名}} の {{氏名}} 様', { name: '田中<b>', company: 'A&B社' });
    expect(out).toBe('こんにちは A&amp;B社 の 田中&lt;b&gt; 様');
  });

  it('件名(escape:false)は素の値を差し込む（&amp; 化しない）', () => {
    const out = renderTemplate('【{{会社名}}】ご案内', { name: null, company: 'A&B社' }, { escape: false });
    expect(out).toBe('【A&B社】ご案内'); // & がそのまま
  });

  it('氏名が無いときは既定「ご担当者」', () => {
    expect(renderTemplate('{{氏名}}', {}, { escape: false })).toBe('ご担当者');
  });

  it('英語別名 {{name}}/{{company}} も置換する', () => {
    expect(renderTemplate('{{name}}@{{company}}', { name: 'Taro', company: 'Acme' }, { escape: false })).toBe('Taro@Acme');
  });
});
