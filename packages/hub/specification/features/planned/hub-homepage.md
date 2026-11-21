---
status: planned
shippedIn: null
unitIds: []
owner: null
reviewedAt: null
---

# Feature: Hub Homepage

## Overview

The Hub root is the public front door of Harness for everyone, signed in or not. It says what Harness is and who it is for, how a change moves from spec to proof, and where to download the Mac app. Its Log in control (Your projects once signed in) opens `/projects`, where Google sign-in and the authorized project cards live.

The page is `src/components/public-site/HomePage.svelte`, rendered by `src/routes/+page.svelte`. Download links come from `src/configs/public-site/homeDownloadConfig.ts`; `src/utils/public-site/publishedDownload.ts` confirms the Mac archive.

## Acceptance Criteria

- `/` shows the hero, how it works, why Harness and the download section to every visitor. It holds no sign-in panel and no project list; besides the sign-in status it asks only whether the Mac archive is published.
- Log in in the header, hero and footer links to `/projects`. Once signed in the same controls read Your projects.
- On each visit the page sends a same-origin `HEAD /downloads/Harness-mac-arm64.zip` without credentials or redirects. Only a 200 answer of type `application/zip` turns Download for Mac into a download link to that path; any other answer, a redirect or a network failure keeps the pending state: the hero link to the download section and the disabled download-section button both read exactly "Mac app coming soon", and the button is described by the note that the build is being prepared. A published archive reads "Download for Mac". Publishing the release switches the link on without rebuilding the site.
- The iPhone app shows Coming soon until a verified store address is set as `ios`.
- The page follows the visitor's light or dark scheme. Dark uses the shared Harness palette; light is mixed from the same catalog tokens. Body and hero text keep at least WCAG AA contrast in both.
- From a 390px phone to a desktop the page never scrolls sideways. The hero sits beside its example loop and the steps share a row from 900px; below that they stack.

## Future Enhancements

- Link the iPhone app once a verified store address exists.
- Prerender the public homepage so its first paint does not wait for the sign-in status.
