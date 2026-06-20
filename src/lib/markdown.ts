import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { pathFromUrl } from "@/lib/media-url";

type HastNode = {
  type?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

export type ImageDimensions = Map<string, { width: number; height: number }>;

// Defer offscreen body images and decode them off the main thread, and — when
// the image's stored dimensions are known — stamp width/height so the browser
// reserves its slot before it loads (no layout shift). Runs AFTER sanitize so
// the added attributes survive (and only ever adds safe, known-numeric ones).
function rehypeLazyImages(dims?: ImageDimensions) {
  return (tree: HastNode) => {
    const walk = (node: HastNode) => {
      if (node.type === "element" && node.tagName === "img") {
        const props = (node.properties = node.properties ?? {});
        props.loading ??= "lazy";
        props.decoding ??= "async";
        const src = typeof props.src === "string" ? props.src : null;
        const path = src ? pathFromUrl(src) : null;
        const dim = path && dims ? dims.get(path) : undefined;
        if (dim && props.width == null && props.height == null) {
          props.width = dim.width;
          props.height = dim.height;
        }
      }
      node.children?.forEach(walk);
    };
    walk(tree);
  };
}

// Markdown -> sanitized HTML. Runs server-side (admin routes) so the same
// conversion is used for both Preview and Publish — guaranteeing parity — and
// the sanitization can't be bypassed. rehype-sanitize strips any unsafe HTML.
// Built per call so the optional `dims` map can be bound to the image plugin.
// Only ever runs in admin save/preview paths (never on public render), so the
// pipeline-construction cost is irrelevant.
export async function markdownToSafeHtml(
  markdown: string,
  dims?: ImageDimensions,
): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeLazyImages, dims)
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}
