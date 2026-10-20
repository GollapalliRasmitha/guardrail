// Server-Sent Events is plain text over a long HTTP response:
//   id: 42            <- the browser remembers this and sends it back as Last-Event-ID when it reconnects
//   event: events     <- the name the page listens for
//   data: [...]       <- one line of JSON
//   (blank line)      <- end of message
// Lines starting with ":" are comments; we send them as heartbeats so proxies don't close an idle connection.

export function sseMessage(input: { id: number; event: string; data: unknown }): string {
  // JSON.stringify escapes newlines inside strings, so data always stays on one "data:" line.
  return `id: ${input.id}\nevent: ${input.event}\ndata: ${JSON.stringify(input.data)}\n\n`;
}

export function sseComment(text: string): string {
  return `: ${text}\n\n`;
}

/** Where to continue from: the browser's Last-Event-ID (on reconnect) wins over ?after= (first connect). */
export function parseCursor(lastEventId: string | null, after: string | null): number | null {
  for (const value of [lastEventId, after]) {
    if (value && /^\d{1,15}$/.test(value)) return Number(value);
  }
  return null;
}
