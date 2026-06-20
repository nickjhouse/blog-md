// Pure markdown formatting transforms for the editor toolbar. Each returns an
// "edit": the range [from,to] of the original value to replace, the replacement
// text, and where the resulting selection should land — so the component can
// apply it (undo-preserving execCommand or a state fallback) and restore focus.

export type FormatAction =
  | "bold"
  | "italic"
  | "strike"
  | "code"
  | "codeblock"
  | "link"
  | "h2"
  | "h3"
  | "quote"
  | "ul"
  | "ol";

export type Edit = {
  from: number;
  to: number;
  text: string;
  selStart: number;
  selEnd: number;
};

const INLINE: Partial<Record<FormatAction, { marker: string; placeholder: string }>> =
  {
    bold: { marker: "**", placeholder: "bold text" },
    italic: { marker: "*", placeholder: "italic text" },
    strike: { marker: "~~", placeholder: "strikethrough" },
    code: { marker: "`", placeholder: "code" },
  };

function inlineEdit(
  value: string,
  start: number,
  end: number,
  marker: string,
  placeholder: string,
): Edit {
  const sel = value.slice(start, end);
  if (!sel) {
    const text = marker + placeholder + marker;
    const selStart = start + marker.length;
    return { from: start, to: end, text, selStart, selEnd: selStart + placeholder.length };
  }
  // Toggle off if the selection is already wrapped in the marker.
  if (
    sel.length >= marker.length * 2 &&
    sel.startsWith(marker) &&
    sel.endsWith(marker)
  ) {
    const inner = sel.slice(marker.length, sel.length - marker.length);
    return { from: start, to: end, text: inner, selStart: start, selEnd: start + inner.length };
  }
  const text = marker + sel + marker;
  return {
    from: start,
    to: end,
    text,
    selStart: start + marker.length,
    selEnd: start + marker.length + sel.length,
  };
}

function linkEdit(value: string, start: number, end: number): Edit {
  const sel = value.slice(start, end);
  const label = sel || "text";
  const text = `[${label}](url)`;
  if (sel) {
    const selStart = start + 1 + label.length + 2; // after "[label]("
    return { from: start, to: end, text, selStart, selEnd: selStart + 3 };
  }
  return { from: start, to: end, text, selStart: start + 1, selEnd: start + 1 + label.length };
}

function codeBlockEdit(value: string, start: number, end: number): Edit {
  const sel = value.slice(start, end) || "code";
  const before = start > 0 && value[start - 1] !== "\n" ? "\n" : "";
  const after = end < value.length && value[end] !== "\n" ? "\n" : "";
  const text = `${before}\`\`\`\n${sel}\n\`\`\`${after}`;
  const selStart = start + before.length + 4; // after "```\n"
  return { from: start, to: end, text, selStart, selEnd: selStart + sel.length };
}

function prefixFor(action: FormatAction): string {
  switch (action) {
    case "h2":
      return "## ";
    case "h3":
      return "### ";
    case "quote":
      return "> ";
    case "ul":
      return "- ";
    default:
      return "1. "; // ol
  }
}

function linePrefixEdit(
  value: string,
  start: number,
  end: number,
  action: FormatAction,
): Edit {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  let lineEnd = value.indexOf("\n", end);
  if (lineEnd === -1) lineEnd = value.length;

  const lines = value.slice(lineStart, lineEnd).split("\n");
  const prefix = prefixFor(action);
  const olRe = /^\d+\.\s/;
  const has = (line: string) =>
    action === "ol" ? olRe.test(line) : line.startsWith(prefix);
  const nonEmpty = lines.filter((l) => l.trim() !== "");
  const allHave = nonEmpty.length > 0 && nonEmpty.every(has);

  const transform = (line: string): string => {
    if (line.trim() === "") return line;
    if (allHave) {
      if (action === "ol") return line.replace(olRe, "");
      return line.startsWith(prefix) ? line.slice(prefix.length) : line;
    }
    if (action === "h2" || action === "h3") {
      return prefix + line.replace(/^#{1,6}\s/, "");
    }
    if (action === "ol" && olRe.test(line)) return line;
    return prefix + line;
  };

  const out = lines.map(transform).join("\n");
  return { from: lineStart, to: lineEnd, text: out, selStart: lineStart, selEnd: lineStart + out.length };
}

export function formatEdit(
  action: FormatAction,
  value: string,
  start: number,
  end: number,
): Edit {
  const inline = INLINE[action];
  if (inline) return inlineEdit(value, start, end, inline.marker, inline.placeholder);
  if (action === "link") return linkEdit(value, start, end);
  if (action === "codeblock") return codeBlockEdit(value, start, end);
  return linePrefixEdit(value, start, end, action);
}
