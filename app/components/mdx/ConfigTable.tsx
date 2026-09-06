const rows = [
  {
    variable: "ED25519_PUBLIC_KEY",
    purpose:
      "Base64url-encoded SPKI DER public key used to verify Worker requests.",
  },
  {
    variable: "UPSTASH_REDIS_REST_URL",
    purpose: "Upstash HTTPS REST URL for one-time nonce storage.",
  },
  {
    variable: "UPSTASH_REDIS_REST_TOKEN",
    purpose: "Upstash REST authentication token.",
  },
];

export function ConfigTable() {
  return (
    <div className="overflow-x-auto">
      <table className="table-sm table">
        <thead>
          <tr>
            <th>Variable</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.variable}>
              <td>
                <code>{row.variable}</code>
              </td>
              <td>{row.purpose}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
