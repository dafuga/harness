# Feature: Codex image forwarding to Claude

## Scope

Daniel explicitly authorized this gateway extension on 2026-10-08. This is an
additional gateway slice while native desktop provider switching remains pending;
it does not satisfy or waive the original installed-desktop delivery gate.

Forward user attachments, replayed historical images and screenshot tool replies
as image blocks using Claude Agent SDK streaming input and MCP image content.
Preserve input order, role labels, call identifiers, ordinary tool text and any
highlight/selection metadata Codex supplies. Do not flatten image bytes into JSON
text, execute Claude built-in tools, extract login tokens or introduce API billing.

## Supported representations

- Responses `input_image` with a base64 data URI.
- Inline `image_url` content, including the nested URL form.
- MCP `image` blocks with base64 data and MIME, including serialized tool output.
- Inline image resources with MIME and a base64 blob.
- Both function and custom tool outputs, including mixed text/image arrays.
- PNG, JPEG, GIF and WebP. Preserve bytes; validate encoding and file signatures.

Each request is bounded to 32 MiB of JSON, 20 images, 5 MiB per image and 20 MiB
of decoded image bytes. Content nesting is bounded. Unsupported media produces
an actionable `unsupported_content` response before inference or tool delivery.
Invalid parallel tool batches consume none of the pending calls.

## Parity gates

| Capability                                              | Gateway status                                     | Installed desktop status                        |
| ------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| Text, streamed replies, history replay                  | Existing experimental support                      | CLI proof; desktop round trip pending           |
| Function/custom/namespaced tool execution               | Bridged back to Codex                              | CLI proof; desktop round trip pending           |
| Inline attachments and screenshot pixels                | Implemented in this slice                          | Actual browser-highlight round trip pending     |
| Highlight/selection metadata                            | Preserved when supplied by Codex                   | No promise that Codex supplies it on every path |
| Remote image URLs, local image paths, provider file IDs | Explicitly rejected; Codex must supply image bytes | Not supported by this slice                     |
| File/PDF, audio and video attachments                   | Explicitly rejected                                | Not supported by this slice                     |
| Voice/TTS and paired-phone reconnection                 | No equivalent transport established                | Separate tests pending                          |
| Applying provider changes from the picker               | Pending desktop control adapter                    | Picker only queues a request                    |
| OpenAI-hosted web search or other hosted tools          | Unsupported; no paid fallback                      | Trial disables hosted web search                |

Full Codex parity is the target, not a delivered capability claim. Features need
provider-specific adapters and verification; unknown or unsupported inputs must
not be silently treated as ordinary text. Native OpenAI remains the default.

## Verification

The same eight integration assertions failed before implementation and passed
unchanged afterward: SDK image input, both correlated screenshot reply formats,
and pre-inference rejection of invalid or unsupported media. Additional tests
cover historical ordering, mutation safety, preserved error metadata, limits,
parallel-batch ownership and cancellation. Generated evidence remains ignored
under `.cache/codex-picker-evidence/`; no screenshots are committed.

Live SDK image checks passed for an attachment and a correlated screenshot tool
reply: both identified the two shapes and an unpredictable four-digit image-only
code. The screenshot was supplied by the smoke host fixture, not the native
Codex browser. The installed desktop-bundled Codex CLI 0.162.0-alpha.2 also sent the same
attachment through the updated local gateway and returned the exact shapes/code.
This is CLI proof, not native desktop panel or browser-highlight proof.

`bun run check` passed: 213 root unit tests, 52 CLI integration tests, one packed
reports test, 88 reports unit tests, formatting/type/lint/build and both Harness
audits. The 25 pre-existing live calibration skips remain unchanged.

The verified gateway code commit is `e6b213b`. Its bundled artifact is installed
under `~/.codex/harness-gateway/artifacts/<commit>/index.js` and served on
127.0.0.1:47841 by `com.dafuga.harness-claude-gateway-images`. Authenticated health
returns text/image capabilities; missing auth is 401 and browser origins are 403.
The Claude provider now points to that listener and its catalog advertises images.
Root defaults remain OpenAI, `gpt-6.1-sol`, with the user's `max` effort. The old
47837 listener stays available for existing callers.

The new LaunchAgent starts at Mac login and keeps the gateway running. To undo
this trial, remove its provider URL/catalog edits using the private before-images
backups and unload/remove only the images LaunchAgent. Preserve unrelated settings
and the original listener. No public hosting or production deployment is involved.
Native desktop rendering/provider switching, phone and voice remain separate gates.
