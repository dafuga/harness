# Feature: Function test examples

## Overview

A function is shown by what its tests observed: one row for each recorded input with the output that was observed for it. It is never shown with a design image. This holds in the workspace that Web, Electron and iOS share and in the Reports explorer; pages and components keep their pictures.

## Acceptance Criteria

- A function has no design thumbnail, no design placeholder, no Designs section and no screenshot of a run. An address that ended in `/designs` opens its plan. No image is read for a function.
- A plan of a function is notes, a contract and proposed cases. It keeps its versions, approval, history and threads, and is never shown as a result.
- A recorded result that states `input` and `output` is one row, named as what a test observed. A result of the form `function-invocations` is a row for each call it records, with the unit and the symbol that was called.
- False, zero, null, an empty list and a thrown error are shown as they were recorded. An error is an observed error, not an output.
- A result that is refused, corrupt, unread, absent, malformed or of another unit says so and shows no row. What an assertion expected and found is never shown as an input or an output.
- A branch tip has one table. A selected commit has the parent's and its own, each with its own gaps; a first commit has one.
- The assertions and the whole recorded result stay available behind a disclosure.
- New images cannot be written to the plan of a function. Earlier versions that hold images are still read as history; their bytes are not altered.

## Known Limits

- Rows exist only where a test recorded them. A function nobody recorded a case for says that none is recorded.
- A result that states `input` and `output` at its top is what a test observed end to end; it is not said to be a call of the function.

## Future Enhancements

- Recorded cases for more functions than the first one.
