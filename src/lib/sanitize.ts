import sanitizeHtml from "sanitize-html";

/**
 * Sanitize HTML produced by TipTap before persisting / rendering.
 * Allowlist matches what the TipTap StarterKit + Link + Image extensions emit.
 * External images allowed (URL only — we never accept uploads here).
 */
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "s",
  "u",
  "code",
  "pre",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "hr",
  "span",
];

const ALLOWED_SCHEMES = ["http", "https", "mailto", "tel"];

export function sanitizeProposalHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "target", "rel", "title"],
      img: ["src", "alt", "title"],
      span: ["class"],
      "*": ["class"],
    },
    allowedSchemes: ALLOWED_SCHEMES,
    allowedSchemesByTag: {
      img: ["http", "https"],
    },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          target: "_blank",
          rel: "noopener noreferrer nofollow",
        },
      }),
    },
  });
}

/** Strip all HTML to plaintext (used for summary fallback and search). */
export function htmlToPlainText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}
