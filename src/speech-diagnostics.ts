import * as fs from "node:fs"
import * as path from "node:path"

// This temporary trace contains private response text. It is off unless a
// specific absolute file path is supplied by the user.
export function speechDiagnostic(event: string, fields: Record<string, unknown>) {
  const file = process.env.OPENCODE_TTS_DIAGNOSTIC_FILE
  if (!file || !path.isAbsolute(file)) return
  try {
    fs.appendFileSync(file, `${JSON.stringify({ time: new Date().toISOString(), pid: process.pid, event, ...fields })}\n`, { mode: 0o600 })
  } catch {
    // Diagnostics must not interrupt speech.
  }
}
