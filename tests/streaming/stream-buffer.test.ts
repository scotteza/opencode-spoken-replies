import { describe, expect, it } from "bun:test"
import { DEFAULT_CONFIG } from "../../src/voice-constants.js"
import { StreamBuffer } from "../../src/streaming/stream-buffer.js"

describe("StreamBuffer", () => {
  it.each([
    "I’ll trace the plugin from its OpenCode event hooks through speech generation and playback, then review how its tests cover those paths. I will not change any files.",
    "The plugin has separate server and terminal UI parts. The terminal UI receives the conversation events and runs playback; the server stores the enabled state and adds speech-friendly prompt guidance.",
  ])("does not isolate the final word of a streamed paragraph", (text) => {
    const buffer = new StreamBuffer("session", "message", "message")
    const delta = buffer.applyDelta(text, "message", DEFAULT_CONFIG, true)
    const final = buffer.applyFinal(text, "message", DEFAULT_CONFIG, false)
    const chunks = [...delta.chunks, ...final.chunks].map((chunk) => chunk.text)
    expect(chunks.join(" ")).toBe(text)
    expect(chunks).not.toContain("files.")
    expect(chunks).not.toContain("guidance.")
  })

  it("keeps a final word together when deltas split before it", () => {
    const buffer = new StreamBuffer("session", "message", "message")
    const first = buffer.applyDelta("I will not change any ", "message", DEFAULT_CONFIG, true)
    const second = buffer.applyDelta("files", "message", DEFAULT_CONFIG, false)
    const final = buffer.applyFinal("I will not change any files", "message", DEFAULT_CONFIG, false)
    expect([...first.chunks, ...second.chunks, ...final.chunks].map((chunk) => chunk.text)).toEqual([
      "I will not change any files.",
    ])
  })

  it("accumulates deltas and drains chunks", () => {
    const config = { ...DEFAULT_CONFIG, streamFlushChars: 10, maxSpeechChunkChars: 30 }
    const buffer = new StreamBuffer("session", "message", "message")

    const first = buffer.applyDelta("Hello", "message", config, true)
    const second = buffer.applyDelta(" world. Again", "message", config, false)

    expect(first.chunks).toEqual([])
    expect(second.chunks.map((chunk) => chunk.text)).toEqual(["Hello world."])
    expect(buffer.rawText).toBe("Hello world. Again")
    expect(buffer.completed).toBe(false)
  })

  it("flushes final text and marks completion", () => {
    const config = { ...DEFAULT_CONFIG, streamFlushChars: 50, maxSpeechChunkChars: 100 }
    const buffer = new StreamBuffer("session", "message", "message")
    buffer.applyDelta("Hello", "message", config, true)

    const result = buffer.applyFinal("Hello world.", "message", config, false)

    expect(result.cursorReset).toBe(false)
    expect(result.nextText).toBe(" world.")
    expect(result.chunks.map((chunk) => chunk.text)).toEqual(["Hello world."])
    expect(buffer.completed).toBe(true)
  })

  it("reports cursor reset when final text diverges", () => {
    const config = { ...DEFAULT_CONFIG, streamFlushChars: 50, maxSpeechChunkChars: 100 }
    const buffer = new StreamBuffer("session", "message", "message")
    buffer.applyDelta("Hello", "message", config, true)

    const result = buffer.applyFinal("Different text.", "message", config, false)

    expect(result.cursorReset).toBe(true)
    expect(result.nextText).toBe("")
    expect(buffer.rawText).toBe("Different text.")
    expect(buffer.completed).toBe(true)
  })

  it("uses configured extensions while streaming", () => {
    const config = { ...DEFAULT_CONFIG, fileExtensions: ["foo"], streamFlushChars: 10, maxSpeechChunkChars: 100 }
    const buffer = new StreamBuffer("session", "message", "message")

    const result = buffer.applyFinal("Open app/widget.foo", "message", config, true)

    expect(result.chunks.map((chunk) => chunk.text)).toEqual(["Open the widget foo file in the app folder."])
  })
})
