"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { Content } from "@tiptap/core";
import {
  Image as ImageIcon,
  Link as LinkIcon,
  ListBullets,
  ListNumbers,
  TextB,
  TextHThree,
  TextItalic,
  TextStrikethrough,
  Quotes,
  Table as TableIcon,
  TextHTwo,
} from "@phosphor-icons/react";

import { getRichTextExtensions } from "@/components/rich-text/extensions";
import { parseRichText, type RichTextDoc } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (next: RichTextDoc) => void;
  placeholder?: string;
  className?: string;
  uploadEndpoint?: string;
  ariaLabel?: string;
};

async function uploadImage(file: File, endpoint: string): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || "Upload failed");
  }

  const json = (await response.json()) as { url: string };
  return json.url;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  uploadEndpoint = "/api/uploads/image",
  ariaLabel,
}: Props) {
  const [initialDoc] = useState<RichTextDoc>(() => parseRichText(value));
  const fileInputId = useId();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: getRichTextExtensions(placeholder),
    content: initialDoc as Content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "ui-prose min-h-52 max-h-[60vh] overflow-y-auto rounded-md border border-border bg-background px-3 py-2.5 text-[13px] leading-6 text-foreground focus:outline-none focus:border-border-strong",
        ),
        "aria-label": ariaLabel ?? "Description editor",
      },
      handlePaste(view, event) {
        const files = event.clipboardData?.files;
        if (!files || files.length === 0) return false;
        const file = Array.from(files).find((f) => f.type.startsWith("image/"));
        if (!file) return false;
        event.preventDefault();
        void insertImageFromFile(file);
        return true;
      },
      handleDrop(view, event) {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        const file = Array.from(files).find((f) => f.type.startsWith("image/"));
        if (!file) return false;
        event.preventDefault();
        void insertImageFromFile(file);
        return true;
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getJSON() as RichTextDoc);
    },
  });

  const insertImageFromFile = useCallback(
    async (file: File) => {
      if (!editor) return;
      setUploadError(null);
      setIsUploading(true);
      try {
        const url = await uploadImage(file, uploadEndpoint);
        editor.chain().focus().setImage({ src: url, alt: file.name }).run();
      } catch (error: unknown) {
        setUploadError(
          error instanceof Error ? error.message : "Image upload failed",
        );
      } finally {
        setIsUploading(false);
      }
    },
    [editor, uploadEndpoint],
  );

  useEffect(() => {
    if (!editor) return;
    // Keep editor in sync if the parent value resets (e.g., modal reopened).
    const nextDoc = parseRichText(value);
    const currentJSON = JSON.stringify(editor.getJSON());
    const nextJSON = JSON.stringify(nextDoc);
    if (currentJSON !== nextJSON) {
      editor.commands.setContent(nextDoc as Content, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) {
    return (
      <div className="ui-skeleton h-32 rounded-md" aria-hidden />
    );
  }

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Toolbar
        editor={editor}
        uploadEndpoint={uploadEndpoint}
        onImageRequest={() => {
          document.getElementById(fileInputId)?.click();
        }}
        isUploading={isUploading}
      />
      <input
        id={fileInputId}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void insertImageFromFile(file);
          event.target.value = "";
        }}
      />
      <EditorContent editor={editor} />
      {uploadError ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-danger">
          {uploadError}
        </p>
      ) : null}
    </div>
  );
}

function Toolbar({
  editor,
  onImageRequest,
  isUploading,
}: {
  editor: ReturnType<typeof useEditor>;
  uploadEndpoint: string;
  onImageRequest: () => void;
  isUploading: boolean;
}) {
  if (!editor) return null;

  const btn = (
    isActive: boolean,
    onClick: () => void,
    icon: React.ReactNode,
    label: string,
  ) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={isActive}
      title={label}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-sm border border-transparent text-muted transition hover:bg-surface hover:text-foreground",
        isActive && "border-border bg-surface text-foreground",
      )}
    >
      {icon}
    </button>
  );

  const promptLink = () => {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previousUrl ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-1">
      {btn(
        editor.isActive("bold"),
        () => editor.chain().focus().toggleBold().run(),
        <TextB className="size-4" />,
        "Bold",
      )}
      {btn(
        editor.isActive("italic"),
        () => editor.chain().focus().toggleItalic().run(),
        <TextItalic className="size-4" />,
        "Italic",
      )}
      {btn(
        editor.isActive("strike"),
        () => editor.chain().focus().toggleStrike().run(),
        <TextStrikethrough className="size-4" />,
        "Strikethrough",
      )}
      <span className="mx-0.5 h-5 w-px bg-border" />
      {btn(
        editor.isActive("heading", { level: 2 }),
        () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        <TextHTwo className="size-4" />,
        "Heading 2",
      )}
      {btn(
        editor.isActive("heading", { level: 3 }),
        () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        <TextHThree className="size-4" />,
        "Heading 3",
      )}
      <span className="mx-0.5 h-5 w-px bg-border" />
      {btn(
        editor.isActive("bulletList"),
        () => editor.chain().focus().toggleBulletList().run(),
        <ListBullets className="size-4" />,
        "Bullet list",
      )}
      {btn(
        editor.isActive("orderedList"),
        () => editor.chain().focus().toggleOrderedList().run(),
        <ListNumbers className="size-4" />,
        "Numbered list",
      )}
      {btn(
        editor.isActive("blockquote"),
        () => editor.chain().focus().toggleBlockquote().run(),
        <Quotes className="size-4" />,
        "Blockquote",
      )}
      <span className="mx-0.5 h-5 w-px bg-border" />
      {btn(
        editor.isActive("link"),
        promptLink,
        <LinkIcon className="size-4" />,
        "Link",
      )}
      {btn(
        false,
        () =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run(),
        <TableIcon className="size-4" />,
        "Insert table",
      )}
      {btn(
        false,
        onImageRequest,
        <ImageIcon className="size-4" />,
        isUploading ? "Uploading…" : "Insert image",
      )}
    </div>
  );
}
