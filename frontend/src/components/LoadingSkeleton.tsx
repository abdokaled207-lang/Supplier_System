export function LoadingSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="table-wrap" role="status" aria-label="Loading…">
      <table>
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i}>
                <span className="skeleton" style={{ width: `${60 + (i % 3) * 15}%` }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }).map((_, c) => (
                <td key={c}>
                  <span className="skeleton" style={{ width: `${70 + ((r + c) % 3) * 10}%` }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <span className="visually-hidden">Loading…</span>
    </div>
  );
}