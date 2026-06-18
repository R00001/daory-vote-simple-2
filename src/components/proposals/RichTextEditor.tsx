"use client";

import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useEffect, useState } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Write the proposal description…",
  minHeight = 280,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: { keepMarks: true, keepAttributes: true },
        orderedList: { keepMarks: true, keepAttributes: true },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: "text-daory-cyan underline underline-offset-2",
          target: "_blank",
          rel: "noopener noreferrer nofollow",
        },
      }),
      Image.configure({
        HTMLAttributes: { class: "max-w-full border border-daory-border my-2" },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose-daory focus:outline-none min-h-[var(--editor-min-h)] px-4 py-3 text-sm leading-relaxed",
        style: `--editor-min-h: ${minHeight}px`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    immediatelyRender: false,
  });

  // Reset content if the parent provides new value (e.g. after fetching a draft)
  useEffect(() => {
    if (editor && value !== editor.getHTML() && value !== "") {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div
        className="bg-black border border-daory-border"
        style={{ minHeight: minHeight + 44 }}
      />
    );
  }

  return (
    <div className="bg-black border border-daory-border focus-within:border-daory-cyan transition-colors">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const [, force] = useState(0);
  // Force a re-render on each selection change so active states reflect.
  useEffect(() => {
    const handler = () => force((n) => n + 1);
    editor.on("selectionUpdate", handler);
    editor.on("transaction", handler);
    return () => {
      editor.off("selectionUpdate", handler);
      editor.off("transaction", handler);
    };
  }, [editor]);

  const handleLink = useCallback(() => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", prev || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const handleImage = useCallback(() => {
    const url = window.prompt("Image URL (https://…)");
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-px bg-daory-border border-b border-daory-border">
      <Btn label="B" title="Bold" active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()} />
      <Btn label="I" title="Italic" italic active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()} />
      <Btn label="S" title="Strikethrough" strike active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()} />
      <Btn label="‹/›" title="Inline code" mono active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()} />
      <Sep />
      <Btn label="H1" title="Heading 1" active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
      <Btn label="H2" title="Heading 2" active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
      <Btn label="H3" title="Heading 3" active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
      <Sep />
      <Btn label="•" title="Bullet list" active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <Btn label="1." title="Numbered list" active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()} />
      <Btn label="❝" title="Blockquote" active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()} />
      <Btn label="—" title="Divider"
        onClick={() => editor.chain().focus().setHorizontalRule().run()} />
      <Sep />
      <Btn label="Link" title="Add / edit link" active={editor.isActive("link")} onClick={handleLink} />
      <Btn label="Image" title="Insert image URL" onClick={handleImage} />
    </div>
  );
}

function Sep() {
  return <div className="w-px self-stretch bg-daory-border" />;
}

function Btn({
  label,
  title,
  onClick,
  active,
  italic,
  strike,
  mono,
}: {
  label: string;
  title: string;
  onClick: () => void;
  active?: boolean;
  italic?: boolean;
  strike?: boolean;
  mono?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
        active
          ? "bg-daory-cyan/10 text-daory-cyan"
          : "bg-daory-card text-daory-muted hover:text-white"
      } ${italic ? "italic" : ""} ${strike ? "line-through" : ""} ${
        mono ? "font-mono normal-case tracking-normal" : ""
      }`}
    >
      {label}
    </button>
  );
}
