"use client";

interface RichTextViewProps {
  html: string;
  className?: string;
}

/**
 * Renders TipTap output. The HTML is already sanitized server-side before
 * persistence (see lib/sanitize.ts), so we render directly with
 * dangerouslySetInnerHTML. Client-side preview content goes through the same
 * sanitizer before being stored, so untrusted HTML cannot reach this view.
 */
export default function RichTextView({ html, className = "" }: RichTextViewProps) {
  return (
    <div
      className={`prose-daory text-sm leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
