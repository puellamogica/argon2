type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  errcode?: number;
  reason?: string;
  ip?: string;
}

export function log(
  event: string,
  data: Partial<Omit<LogEntry, "timestamp" | "event">>,
) {
  const { level = "info", ...rest } = data;
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...rest,
  };
  const line = JSON.stringify(entry);
  if (entry.level === "error") {
    console.error(line);
  } else if (entry.level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}
