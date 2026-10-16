# Feature: Writing Versions

## Overview

The writing limits have versions. A repository declares one as `"writing"` in
`harness.verify.json`. Version 1 allows each simplification or performance attempt of a reason 20
words; version 2 allows 15. Nothing else differs: the behaviour note has 30 words and 200
characters, an attempt 140 characters, a commit subject 72 characters and a commit body 60 words
and 400 characters in both. A reason is held to the version declared by the revision it
explains, so what was written under version 1 stays valid and what is written for version 2
content is never given the older allowance.

## Acceptance Criteria

- Under version 2 an attempt of exactly 15 words passes and one of 16 is refused; under version 1
  exactly 20 pass and 21 are refused. Each of the two attempts is held on its own.
- Characters are Unicode code points, line endings count once and words end at any whitespace;
  140 characters of an attempt and 200 of a behaviour note pass in both versions and one more
  does not.
- `harness explain add` holds a new reason to the version of the head of its range and stores
  nothing when it refuses. Where the head declares no version it refuses what version 1 would,
  as before there were versions.
- A reason put into the store by hand for a version 2 change fails `harness explain check` and
  the verification of a clean snapshot at 16 words, whatever `recordedAt` it carries.
- A revision that declares version 1 keeps reasons of 16 to 20 words valid, in the check and in
  verification. A revision that declares none fails on no length.
- A range that holds both versions is judged step by step along its first parents: each step by
  the version its own revision declares. An earlier note is not refused by a later version, and
  a reason for the whole range is held to the version of the head.
- A commit message is held to the same limits under either version, by the staged configuration
  in the commit-msg hook and by the configuration of each stored revision in verification. A
  declaration that is only in the working tree holds nothing.
- Configurations without `writing`, stored records, notes and their hashes are read as they are.

## Future Enhancements

- State the version a record was judged under in the record itself.
