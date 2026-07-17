import { describe, it, expect } from 'vitest';
import {
  looksLikeHtml, escapeHtml, plainTextToHtml, htmlToPlainText, isRichEmpty, stripDangerousHtml,
  splitUrlTrailingPunct,
} from '@/lib/richtext';

describe('looksLikeHtml', () => {
  it('detects HTML tags', () => {
    expect(looksLikeHtml('<p>hi</p>')).toBe(true);
    expect(looksLikeHtml('<a href="x">y</a>')).toBe(true);
  });
  it('treats plain text (incl. bare < >) as non-HTML', () => {
    expect(looksLikeHtml('分析資料の作成')).toBe(false);
    expect(looksLikeHtml('利益 > 前年 かつ 5 < 10')).toBe(false);
    expect(looksLikeHtml('')).toBe(false);
  });
});

describe('escapeHtml', () => {
  it('escapes special chars', () => {
    expect(escapeHtml('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&#39;');
  });
});

describe('plainTextToHtml (legacy plain-text → safe HTML)', () => {
  it('linkifies a Google Drive URL into a clickable anchor', () => {
    const url = 'https://drive.google.com/drive/folders/1Ha25KG5v9ljju4waG1qNYPULRsRYTK-d?usp=sharing';
    const html = plainTextToHtml(`分析資料の作成\n\n${url}`);
    expect(html).toContain(`<a href="${url}" target="_blank" rel="noopener noreferrer nofollow">${url}</a>`);
    // 段落分割（空行）
    expect(html).toMatch(/^<p>分析資料の作成<\/p><p>/);
  });
  it('single newline becomes <br>, double newline becomes new paragraph', () => {
    const html = plainTextToHtml('a\nb\n\nc');
    expect(html).toBe('<p>a<br>b</p><p>c</p>');
  });
  it('escapes HTML so injected markup is inert', () => {
    const html = plainTextToHtml('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
  it('empty / whitespace-only text yields empty string', () => {
    expect(plainTextToHtml('')).toBe('');
    expect(plainTextToHtml('   \n  ')).toBe('');
  });
});

describe('splitUrlTrailingPunct', () => {
  it('splits trailing JP/half-width punctuation off the URL', () => {
    expect(splitUrlTrailingPunct('https://x.com/a）')).toEqual({ href: 'https://x.com/a', tail: '）' });
    expect(splitUrlTrailingPunct('https://x.com/a.')).toEqual({ href: 'https://x.com/a', tail: '.' });
    expect(splitUrlTrailingPunct('https://x.com/a。')).toEqual({ href: 'https://x.com/a', tail: '。' });
  });
  it('does NOT strip trailing ; (keeps &amp; entities intact)', () => {
    expect(splitUrlTrailingPunct('https://x.com/a?b=1&amp;')).toEqual({ href: 'https://x.com/a?b=1&amp;', tail: '' });
  });
  it('leaves a clean URL untouched', () => {
    const u = 'https://drive.google.com/drive/folders/1Ha25?usp=sharing';
    expect(splitUrlTrailingPunct(u)).toEqual({ href: u, tail: '' });
  });
});

describe('htmlToPlainText / isRichEmpty', () => {
  it('strips tags and treats empty TipTap output as empty', () => {
    expect(isRichEmpty('<p></p>')).toBe(true);
    expect(isRichEmpty('<p><br></p>')).toBe(true);
    expect(isRichEmpty('')).toBe(true);
    expect(isRichEmpty(null)).toBe(true);
    expect(isRichEmpty('<p>実質あり</p>')).toBe(false);
  });
  it('keeps text and normalizes line breaks', () => {
    expect(htmlToPlainText('<p>一</p><p>二</p>')).toBe('一\n二');
  });
});

describe('stripDangerousHtml (server-side defense-in-depth)', () => {
  it('removes <script> with content', () => {
    expect(stripDangerousHtml('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>');
  });
  it('removes event-handler attributes', () => {
    expect(stripDangerousHtml('<a href="https://x" onclick="steal()">x</a>')).toBe('<a href="https://x">x</a>');
  });
  it('neutralizes javascript: URLs', () => {
    const out = stripDangerousHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toMatch(/javascript:/i);
  });
  it('removes iframe/object/embed', () => {
    expect(stripDangerousHtml('<iframe src="https://evil"></iframe><p>keep</p>')).toBe('<p>keep</p>');
  });
  it('keeps safe formatting untouched', () => {
    const safe = '<p><strong>太字</strong> と <a href="https://x" target="_blank" rel="noopener noreferrer nofollow">リンク</a></p><ul><li>項目</li></ul>';
    expect(stripDangerousHtml(safe)).toBe(safe);
  });
});
