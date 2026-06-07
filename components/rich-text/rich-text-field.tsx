"use client";

// Form-field wrapper: shows the RichTextEditor and keeps a hidden input in
// sync so the value flies through a plain form submission as JSON.

import { useState } from "react";

import { RichTextEditor } from "@/components/rich-text";
import {
  parseRichText,
  type RichTextDoc,
  serializeRichText,
} from "@/lib/rich-text";

export function RichTextField({
  name,
  defaultValue,
  placeholder,
  uploadEndpoint,
  ariaLabel,
}: {
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  uploadEndpoint?: string;
  ariaLabel?: string;
}) {
  const [initialValue] = useState(() =>
    serializeRichText(parseRichText(defaultValue)),
  );
  const [doc, setDoc] = useState<RichTextDoc>(parseRichText(defaultValue));

  return (
    <>
      <input type="hidden" name={name} value={serializeRichText(doc)} />
      <RichTextEditor
        value={initialValue}
        onChange={setDoc}
        placeholder={placeholder}
        uploadEndpoint={uploadEndpoint}
        ariaLabel={ariaLabel}
      />
    </>
  );
}
