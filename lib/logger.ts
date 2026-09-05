type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  errcode?: number;
  reason?: string;
  ip?: string;
}

export function log(event: string, data: Partial<LogEntry>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: data.level || "info",
    event,
    ...data,
  };
  console.log(JSON.stringify(entry));
}
