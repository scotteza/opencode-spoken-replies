# Speech chunk diagnostics

## Goal

Find why the last word of a sentence sometimes sounds separate from the rest.
The cause is not yet known. Do not assume that the text splitter is at fault.
This is a temporary local diagnostic, not a production logging feature.

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
