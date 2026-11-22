import { expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { speechDiagnostic } from "../src/speech-diagnostics.js"
import { DEFAULT_CONFIG } from "../src/voice-constants.js"
import { drainStreamChunks } from "../src/voice-text.js"

it("writes private diagnostics only for an absolute opt-in path", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "speech-diagnostics-"))
  const file = path.join(dir, "trace.jsonl")
  const previous = process.env.OPENCODE_TTS_DIAGNOSTIC_FILE
  try {
    delete process.env.OPENCODE_TTS_DIAGNOSTIC_FILE
    speechDiagnostic("disabled", { text: "private" })
    expect(fs.existsSync(file)).toBe(false)
    process.env.OPENCODE_TTS_DIAGNOSTIC_FILE = file
    speechDiagnostic("test", { text: "private\ntext" })
    const entry = JSON.parse(fs.readFileSync(file, "utf8"))
    expect(entry.event).toBe("test")
    expect(entry.text).toBe("private\ntext")
    expect(entry.time).toBeTruthy()
  } finally {
    if (previous === undefined) delete process.env.OPENCODE_TTS_DIAGNOSTIC_FILE
    else process.env.OPENCODE_TTS_DIAGNOSTIC_FILE = previous
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

it("records chunk decisions without changing the output", () => {
  const decisions: Record<string, unknown>[] = []
  const text = "First sentence. Remaining words"
  const plain = drainStreamChunks(text, DEFAULT_CONFIG, true)
  const traced = drainStreamChunks(text, DEFAULT_CONFIG, true, (decision) => decisions.push(decision))
  expect(traced).toEqual(plain)
  expect(decisions.map((decision) => decision.reason)).toEqual(["final-boundary", "final-remainder"])
  expect(decisions[1]?.text).toBe("Remaining words")
})
