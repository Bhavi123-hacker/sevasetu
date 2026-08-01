export default function ComingSoon({ pageName }) {
  return (
    <div className="card">
      <h2>{pageName}</h2>
      <p style={{ color: 'var(--color-ink-muted)' }}>
        Not ported to React yet — this page still works in the Streamlit app at the same backend.
        Being migrated one page at a time; the citizen upload flow went first.
      </p>
    </div>
  )
}
