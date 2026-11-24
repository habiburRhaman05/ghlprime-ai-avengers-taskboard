export default function BoardLoading() {
  return <div className="loading-view" role="status" aria-label="Loading task board">
    <div className="skeleton skeleton-eyebrow" /><div className="skeleton skeleton-heading" /><div className="skeleton skeleton-subheading" />
    <div className="skeleton-grid">{[0, 1, 2, 3, 4].map(item => <div className="skeleton-card" key={item}>
      <div className="skeleton skeleton-card-title" /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line short" />
    </div>)}</div><span className="sr-only">Loading task board…</span>
  </div>;
}
