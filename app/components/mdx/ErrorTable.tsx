const borderColors: Record<string, string> = {
  success: "border-success",
  warning: "border-warning",
  error: "border-error",
};

export function ErrorTable() {
  const rows = [
    {
      code: "0",
      success: true,
      http: "200",
      style: "success",
      meaning: "Verified, no rehash needed",
    },
    {
      code: "1",
      success: false,
      http: "400",
      style: "warning",
      meaning: "Config mismatch - hash needs rehash",
    },
    {
      code: "2",
      success: false,
      http: "400",
      style: "warning",
      meaning: "Invalid hash format",
    },
    {
      code: "3",
      success: false,
      http: "400",
      style: "error",
      meaning: "Wrong password",
    },
    {
      code: "4",
      success: false,
      http: "500",
      style: "error",
      meaning: "Internal error",
    },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="table-sm table">
        <thead>
          <tr>
            <th>errcode</th>
            <th>success</th>
            <th>HTTP</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.code}>
              <td>{row.code}</td>
              <td>
                <span
                  className={`badge badge-sm text-base-content ${borderColors[row.style]}`}
                >
                  {String(row.success)}
                </span>
              </td>
              <td>{row.http}</td>
              <td>{row.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
