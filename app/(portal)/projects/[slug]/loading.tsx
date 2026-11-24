export default function BoardLoading() {
  return <div className="loading-view" role="status" aria-label="Loading project">
    <div className="skeleton skeleton-eyebrow" /><div className="skeleton skeleton-heading" /><div className="skeleton skeleton-subheading" />
    <div className="skeleton-card vault-skeleton">
      <div className="skeleton skeleton-card-title" /><div className="skeleton skeleton-line short" />
    </div>
    <div className="skeleton-grid">{[0, 1, 2, 3, 4].map(item => <div className="skeleton-card" key={item}>
      <div className="skeleton skeleton-card-title" /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line short" />
    </div>)}</div><span className="sr-only">Loading project…</span>
  </div>;
}
