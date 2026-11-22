# Speech chunk diagnostics

## Handoff: isolated final words

### Status

The local diagnostic test reproduced the problem twice. The logs show that the
plugin inserted a newline into the speech buffer before the last word, even
though the incoming text had no newline at that point. The chunk splitter then
treated that newline as a boundary and sent the last word separately to the
speech engine. No fix has been made yet.

The working branch is `do-not-merge-speech-chunk-diagnostics`. It contains
temporary, opt-in logging. Do not push or merge this diagnostic branch without
the user's agreement. Preserve its current changes.

### Observed evidence

The user asked OpenCode to inspect this plugin and describe its architecture.
They heard a pause immediately before the last word in each example:

1. “I will not change any files.”
2. “The terminal UI receives the conversation events and runs playback; the
   server stores the enabled state and adds speech-friendly prompt guidance.”

For the first example, the incoming `stream.delta` ended with
`paths. I will not change any files.` with no newline before `files`. The
sanitized speech buffer instead ended with `change any\nfiles.` The
`stream.decision` event recorded `reason: "newline"` and emitted the text
ending in `change any`. At `stream.text-part-ended`, the buffer held
`files.`, which was then enqueued as a separate chunk. The helper generated
`I will not change any` and `files.` as separate audio segments.

For the second example, one incoming `stream.delta` contained the whole
paragraph, with no newline before `guidance`. The speech buffer ended with
`speech-friendly prompt\nguidance.` The newline decision emitted the text
ending in `prompt`. The text-part-ended event later flushed `guidance.` as a
separate chunk.

The playback logs also record an intentional pause between the first chunk and
the final-word chunk. Separate synthesis may affect intonation as well as the
pause. These observations establish the premature split in both examples; they
do not establish that every reported pause has the same cause.

The user noticed tool calls around the affected messages. The logs do not show
that the tool calls caused the split. A complex task may affect the timing or
shape of streamed text, but that remains unproven.

### Likely code path to investigate

- `src/streaming/stream-buffer.ts` passes each delta to `SpeechSanitizer.push`
  and appends its output to the speech buffer.
- `src/voice-sanitize.ts` can emit partial text while retaining a trailing word.
  `SpeechSanitizer.push` currently combines its output entries with
  `output.filter(Boolean).join("\\n")`. Check how multiple entries from the
  same input line can reach that join. This is the likely source of the
  artificial newline, but confirm it with a focused test before changing it.
- `src/voice-text.ts` treats a newline in the sanitized buffer as a chunk
  boundary. The splitter acted on the newline it received; the raw model output
  did not contain that boundary.
- `src/streaming/streaming-controller.ts` handles `session.text.ended` and
  flushes remaining text. This marks the end of a text part, not necessarily
  the entire assistant response.

Do not simply remove all newlines. Actual newlines and sanitizer-generated
boundaries for Markdown structures can be meaningful. Preserve spacing,
punctuation, formatting cleanup, and existing behavior for tables, code blocks,
headings, lists, and streaming fragments.

### Next steps

1. Add focused regression tests that reproduce both examples through the
   sanitizer and stream buffer. Assert that no artificial newline or isolated
   final-word chunk is produced.
2. Test different delta boundaries, including a complete paragraph in one
   delta, a trailing word held across deltas, and text-part completion without
   final punctuation. Include real newlines and Markdown structures.
3. Fix the confirmed sanitizer boundary handling. Keep the change narrow and
   do not alter the speech engine or playback timing without evidence.
4. Run `sh scripts/build-and-test.sh` and `npm pack --dry-run`. Review the
   results and any warnings.
5. Rebuild and repeat the live test in `~/development/forks/oc-test`. Ask the
   user to listen and compare the new diagnostic events. Test both live speech
   and replay where useful.
6. Decide with the user how to remove the temporary diagnostics and move the
   actual fix to an appropriate branch. Do not publish the npm package.

### Local test and privacy

`~/development/forks/oc-test/opencode.jsonc` points to this checkout. The
user planned to remove the published plugin entry from the global config;
verify the active configuration rather than assuming that was done.

To collect a trace, start the OpenCode terminal UI in the test directory with
`OPENCODE_TTS_DIAGNOSTIC_FILE="$HOME/opencode-speech-diagnostics.jsonl"`.
The file appends across runs and contains private response text. Inspect it
before sharing. Do not remove it without the user's agreement.

The initial diagnostic implementation passed the build, 134 automated tests,
the audio test with playback, and `npm pack --dry-run`. It has been tested
inside OpenCode and produced the evidence above.

## Goal

Find why the last word of a sentence sometimes sounds separate from the rest.
The handoff above records the findings so far. This is a temporary local
diagnostic, not a production logging feature.

## Diagnostic scope

- Record the raw streamed text and actual newline characters as they arrive.
  Identify the session, message, text part, and event order.
- Record each buffering decision: the available text, whether a chunk was
  emitted, the text and remaining buffer, and the rule that caused the
  decision. Include punctuation, newline, length limit, and end-of-text-part
  decisions, as applicable. Record relevant configuration values.
- Record every text chunk sent to the speech engine and its identifier.
- Record every audio segment returned by the engine, its associated text,
  parent chunk identifier, and generation time.
- Record playback start and end times for each segment, plus intentional
  pauses. Make gaps between segments measurable.
- Use timestamps and stable identifiers to correlate events across processes.
  Distinguish the end of a text part from the end of a complete response.

Inspect the existing logger and event flow before implementation. Reuse existing
diagnostics where possible. Do not change chunking or playback behavior while
collecting evidence.

## Privacy and operation

- Make detailed logging explicitly opt-in and disabled by default.
- Keep logs in a local file. Document its exact location and how to enable and
  disable logging. Do not upload logs or change global configuration.
- Logs can contain full responses and other private text. Warn before sharing
  them, and explain how to remove the diagnostic file after analysis.
- Avoid logging credentials, environment variables, or unrelated data.

## Test plan

- Add automated tests for opt-in behavior and for the diagnostic events and
  boundary reasons. Confirm that logging does not change speech output.
- Test short and long sentences, punctuation, actual newlines, visual wrapping,
  incomplete final sentences, and streamed text split just before the last word.
- Include the reported examples ending in “it”, “pieces”, and “themselves”.
  Test both live speech and replay of the same text.
- Compare chunk boundaries, returned audio segments, and playback gaps with
  what is heard. Record uncertainty if the logs do not establish a cause.
- Run the project's required build and test checks for the implementation.

## Done when

A local test can identify whether the separation occurred before synthesis,
within the speech engine's audio segments, or between playback segments, or
clearly state which additional evidence is needed. No fix is implied by this
diagnostic spec.
