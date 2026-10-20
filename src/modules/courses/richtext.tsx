import { Fragment, type ReactNode } from "react";

/**
 * Safe "simple formatting" for lesson and course text. Never renders HTML:
 *   blank line   -> new paragraph
 *   "## Title"   -> heading
 *   "- item"     -> bullet list
 *   https://...  -> link (opens in a new tab)
 *   ![alt](/media/...) on its own line -> image from our own Media library only
 */

export type Block =
  | { type: "h"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "p"; lines: string[] }
  | { type: "img"; alt: string; src: string };

// Only images served by this site (public Media files) can be embedded.
const IMAGE_RE = /^!\[([^\]]{0,200})\]\((\/media\/[A-Za-z0-9/_.-]{1,300})\)$/;

export function parseRichText(input: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of input.replace(/\r\n?/g, "\n").split(/\n{2,}/)) {
    const lines = chunk.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
    let para: string[] = [];
    let list: string[] = [];
    const flush = () => {
      if (para.length) blocks.push({ type: "p", lines: para });
      if (list.length) blocks.push({ type: "ul", items: list });
      para = [];
      list = [];
    };
    for (const line of lines) {
      const t = line.trim();
      const img = IMAGE_RE.exec(t);
      if (img && !img[2]!.includes("..")) {
        flush();
        blocks.push({ type: "img", alt: img[1]!, src: img[2]! });
      } else if (t.startsWith("## ")) {
        flush();
        blocks.push({ type: "h", text: t.slice(3).trim() });
      } else if (/^[-*•] /.test(t)) {
        if (para.length) flush();
        list.push(t.slice(2).trim());
      } else {
        if (list.length) flush();
        para.push(t);
      }
    }
    flush();
  }
  return blocks;
}

const URL_RE = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;

function linkify(text: string): ReactNode[] {
  return text.split(URL_RE).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline underline-offset-4">
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

export function RichText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`space-y-4 leading-relaxed ${className}`} dir="auto">
      {parseRichText(text).map((b, i) =>
        b.type === "img" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={b.src} alt={b.alt} loading="lazy" className="h-auto w-full rounded-2xl ring-1 ring-white" />
        ) : b.type === "h" ? (
          <h3 key={i} className="pt-2 text-xl font-semibold text-charcoal-900">{linkify(b.text)}</h3>
        ) : b.type === "ul" ? (
          <ul key={i} className="list-disc space-y-1 ps-6 marker:text-sun-500">
            {b.items.map((item, j) => <li key={j}>{linkify(item)}</li>)}
          </ul>
        ) : (
          <p key={i}>
            {b.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {linkify(l)}
              </Fragment>
            ))}
          </p>
        ),
      )}
    </div>
  );
}
