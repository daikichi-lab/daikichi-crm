'use client';
// 課題説明の WYSIWYG エディタ（TipTap）。太字/斜体/下線/取り消し線/見出し/箇条書き/番号/リンク。
// 出力は HTML（保存前・表示前に必ずサニタイズ）。Next SSR 対策で immediatelyRender:false。
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { looksLikeHtml, plainTextToHtml } from '@/lib/richtext';

type Cmd = { key: string; label: string; title: string; run: (e: Editor) => void; active: (e: Editor) => boolean };

const COMMANDS: Cmd[] = [
  { key: 'bold', label: 'B', title: '太字', run: (e) => e.chain().focus().toggleBold().run(), active: (e) => e.isActive('bold') },
  { key: 'italic', label: 'I', title: '斜体', run: (e) => e.chain().focus().toggleItalic().run(), active: (e) => e.isActive('italic') },
  { key: 'underline', label: 'U', title: '下線', run: (e) => e.chain().focus().toggleUnderline().run(), active: (e) => e.isActive('underline') },
  { key: 'strike', label: 'S', title: '取り消し線', run: (e) => e.chain().focus().toggleStrike().run(), active: (e) => e.isActive('strike') },
  { key: 'h2', label: '見出し', title: '見出し', run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), active: (e) => e.isActive('heading', { level: 2 }) },
  { key: 'bullet', label: '• 箇条書き', title: '箇条書き', run: (e) => e.chain().focus().toggleBulletList().run(), active: (e) => e.isActive('bulletList') },
  { key: 'ordered', label: '1. 番号', title: '番号付き', run: (e) => e.chain().focus().toggleOrderedList().run(), active: (e) => e.isActive('orderedList') },
];

export function RichEditor({ value, onChange, disabled }: {
  value: string; onChange: (html: string) => void; disabled?: boolean;
}) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } })],
    content: looksLikeHtml(value) ? value : plainTextToHtml(value),
    editable: !disabled,
    immediatelyRender: false, // Next.js SSR のハイドレーション不整合を回避
    editorProps: { attributes: { class: 'rich-input', role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return <div className="rich-editor"><div className="rich-input" aria-hidden>読み込み中…</div></div>;

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('リンク先URL（空にすると解除）', prev ?? 'https://');
    if (url === null) return; // キャンセル
    if (url.trim() === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  return (
    <div className={`rich-editor${disabled ? ' is-disabled' : ''}`}>
      <div className="rich-toolbar" role="toolbar" aria-label="書式">
        {COMMANDS.map((c) => (
          <button
            key={c.key} type="button" className={`rt-btn${c.active(editor) ? ' on' : ''}`}
            title={c.title} aria-pressed={c.active(editor)} disabled={disabled}
            onMouseDown={(e) => e.preventDefault()} onClick={() => c.run(editor)}
          >{c.label}</button>
        ))}
        <button
          type="button" className={`rt-btn${editor.isActive('link') ? ' on' : ''}`}
          title="リンク" disabled={disabled}
          onMouseDown={(e) => e.preventDefault()} onClick={setLink}
        >🔗 リンク</button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
