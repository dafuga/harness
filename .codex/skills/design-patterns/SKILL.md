---
name: design-patterns
description: Use for ANY UI design or UI code in Daniel's apps (Harness Hub web, Mac app, iPhone app, Harbor, BuildFlexity, Fluora, Novaylo...) - the design patterns Daniel requires, starting with "never a form inside a card that is part of a list". Read before designing or building lists, cards, inboxes, needs-you views, chat, or answer/option UIs. Pair with ui-polish-check.
---

# Design patterns (Daniel's rules)

Each rule is a pattern every app follows. When a screen breaks one, fix the screen, not the rule. Add new rules here when Daniel sets one (with date and his words).

## 1. Never a form inside a card that is part of a list (Daniel, 27 Nov 2026)

"Let's add a design skill that says that you should never have a form in a card that's part of a list."

- A card in a list (feed, inbox, needs-you list, project list, search results) is a **compact summary**: title, one or two lines of context, status/age, and at most one or two one-tap actions shown as small buttons or chips.
- **No text inputs, text areas, selects, multi-step option forms, chat composers or "Other... write an answer" fields inside a list card.** Anything that needs typing or more than one tap opens a **detail view** (side panel, sheet on phone, or overlay) for that one item, and the form lives there.
- Option/answer choices shown in a list card are compact one-line chips or buttons (label, "Recommended" as a small badge, no multi-line descriptions); the full descriptions live in the detail view.
- Keep list cards short: aim for 1-3 lines of content per card so several items fit on one screen.

## 2. Chat lives in one overlay widget, not in cards (Daniel, 27 Nov 2026)

"The chief of staff card should just let you go to the chat widget, which should be an overlay widget in the bottom right corner where you should be able to chat with the agent. But you shouldn't be able to chat with the agent from the card."

- Chat with an agent (Chief of Staff or any session) happens in a single **floating overlay widget, bottom-right corner** (full-screen sheet on phone), opened from anywhere.
- A card about an agent shows its status and an "Open chat" button that opens the overlay; the card itself never has a message box.

## 3. Links are always clickable (Daniel, 27 Nov 2026)

"links should be clickable"

- Every URL shown in text (item titles, questions, options, notes, chat) is rendered as a real link: http/https only, opens in a new tab with rel="noopener noreferrer", and long URLs wrap instead of overflowing.

## 4. Clicks feel smooth: nothing vanishes instantly (Daniel, 27 Nov 2026)

"I wanna see like a nice animation when I click on something. I don't want the card to disappear right away. I want it to like fade out or something like that."

- Every click gets immediate feedback (pressed state, then a loading state if it takes more than ~150 ms).
- When an action removes a card (answered, dismissed, done), first show the result (e.g. the chosen option confirmed), then fade/collapse it out over ~250-400 ms while the rest of the list closes the gap smoothly. Never pop it out of the list instantly.
- Detail views, overlays and collapsible sections open and close with short eased transitions. Respect prefers-reduced-motion.

## 5. Show what is happening now, never "overdue Nh" (Daniel, 27 Nov 2026)

"If something is due, we should just write due now, or is being worked on or something like that. We don't need to mention that it was planned to be worked on a certain number of hours ago if it's being worked on."

- Status labels describe the present: Running, Queued #N, Due now, Blocked (with the reason), Done. Never "overdue 16h" or "planned N hours ago".
- A passed due date is not shown in error red; red is for real failures that need action.

## 6. Answer options sit in a grid, not one per row (Daniel, 27 Nov 2026)

Multiple-choice options (needs-you asks, canary asks, any option buttons) are laid out as a compact grid on desktop and tablet (e.g. 2-4 equal columns, auto-fit), and only stack one per row on phone widths. Recommended is a small badge on its tile; "Other..." is a tile that opens a modal. Never a full-width row per option on a wide screen.

## Check before calling UI done

- Every URL on the page is clickable.
- Removing or answering a card animates out; clicks show instant feedback.
- Every list card: no inputs, no composer, no long option descriptions. Typing happens in a detail view or the chat overlay.
- Screenshot the real page at phone and desktop width (see ui-polish-check) and confirm several list items fit on one screen.
