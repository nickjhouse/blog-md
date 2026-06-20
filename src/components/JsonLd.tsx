// Renders a schema.org JSON-LD <script> in the server HTML (no client JS).
// Plain object in → <script type="application/ld+json"> out.
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify escapes the data; guard the one sequence that can break
      // out of a <script> element.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
