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
      meaning: "Password verified",
    },
    {
      code: "1",
      success: false,
      http: "401",
      style: "error",
      meaning: "Signature missing or invalid",
    },
    {
      code: "2",
      success: false,
      http: "413",
      style: "error",
      meaning: "Request body too large",
    },
    {
      code: "3",
      success: false,
      http: "400",
      style: "error",
      meaning: "Request validation failed",
    },
    {
      code: "4",
      success: false,
      http: "422",
      style: "warning",
      meaning: "Config mismatch - hash needs rehash",
    },
    {
      code: "5",
      success: false,
      http: "401",
      style: "error",
      meaning: "Wrong password",
    },
    {
      code: "6",
      success: false,
      http: "500",
      style: "error",
      meaning: "Internal error",
    },
    {
      code: "7",
      success: false,
      http: "409",
      style: "warning",
      meaning: "Request nonce already used",
    },
    {
      code: "8",
      success: false,
      http: "503",
      style: "warning",
      meaning: "Authentication or replay protection unavailable",
    },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="table-sm mt-0 table">
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
