// Shown instantly on navigation to a post while it renders. Pairs with
// prefetch={false} on feed/related/series links: clicking a card gives immediate
// visual feedback (a skeleton matching the post layout) instead of a dead pause.
export default function PostLoading() {
  return (
    <article className="animate-pulse" aria-hidden="true">
      {/* reading-progress bar placeholder (full-width, no layout impact) */}
      <div className="fixed left-0 top-0 z-50 h-[3px] w-1/3 bg-(--accent)" />
      {/* back link */}
      <div className="h-4 w-16 rounded-sm bg-(--hover)" />
      {/* meta line */}
      <div className="mt-6 h-3 w-56 rounded-sm bg-(--hover)" />
      {/* title (two lines) */}
      <div className="mt-3 h-8 w-11/12 rounded-sm bg-(--hover)" />
      <div className="mt-2 h-8 w-2/3 rounded-sm bg-(--hover)" />
      {/* body */}
      <div className="mt-8 space-y-3">
        {["100%", "97%", "92%", "65%", "100%", "88%", "70%"].map((w, i) => (
          <div
            key={i}
            className="h-4 rounded-sm bg-(--hover)"
            style={{ width: w }}
          />
        ))}
      </div>
    </article>
  );
}
