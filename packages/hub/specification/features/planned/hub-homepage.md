---
status: planned
shippedIn: null
unitIds: []
owner: null
reviewedAt: null
---

# Feature: Hub Homepage

## Overview

The Hub root is the public front door of Harness. A visitor who is not signed in reads what Harness is and who it is for, how a change moves from spec to proof, where to download the Mac app, and how to log in. A signed-in person sees their shared projects at the same address, unchanged.

The page is `src/components/public-site/HomePage.svelte`, chosen by `src/routes/+page.svelte` while nobody is signed in. Download links come from `src/configs/public-site/homeDownloadConfig.ts`.

## Acceptance Criteria

- Signed out, `/` shows the hero, how it works, why Harness, the download section and the existing Google sign-in panel. It reads nothing but the sign-in status and challenge.
- Log in in the header, hero and footer moves to the sign-in panel. After sign-in the same page shows the person's projects without a reload.
- Signed in, `/` shows the projects view and no homepage.
- Download for Mac links to the published desktop build. While `mac` is null the hero leads to the download section, where a disabled button explains that the build is being prepared. The iPhone app shows Coming soon until `ios` is set.
- The page follows the visitor's light or dark scheme. Dark uses the shared Harness palette; light is mixed from the same catalog tokens. Body and hero text keep at least WCAG AA contrast in both.
- From a 390px phone to a desktop the page never scrolls sideways. The hero sits beside its example loop and the steps share a row from 900px; below that they stack.
- No JavaScript is added beyond the existing page; the homepage is static markup and CSS.

## Future Enhancements

- Link the hosted Mac build and the iPhone app once each is published.
- Prerender the public homepage so its first paint does not wait for the sign-in status.
