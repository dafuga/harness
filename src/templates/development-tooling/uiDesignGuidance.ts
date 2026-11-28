// @harness-uid u_waj3b3a3ii
/** UI design patterns every Harness worker and designer follows; the Harness home is the example. */
export const uiDesignPatternRules = [
	'One main piece per screen. A screen has one main UI piece (a list, a board, a form or a canvas). Everything else is a primary action above it or quiet status below it. Two main pieces need two screens, tabs or a dialog.',
	'Forms never sit inline on an overview. Create, edit, connect and settings forms open from a button in a dialog (the shared Modal) or on their own page. Mark overview screens with <!-- @harness-view overview -->; harness audit reports overview-inline-form for a form control or form component outside a dialog there. A search field inside a role="search" landmark only narrows the main piece and is allowed.',
	'List cards never contain forms. Show one-line option chips with a small Recommended badge, and put explanations, text fields, selectors and confirmation steps in the item’s detail panel, sheet or dialog.',
	'Lay out answer tiles in a grid of two to four columns on desktop and tablet, and one column at phone widths. The Other… tile opens a dialog.',
	'Agent cards show status and an Open chat button. Open the conversation in a bottom-right overlay on desktop and a full-screen sheet on phone.',
	'Render explicit HTTP and HTTPS URLs in item text, questions, choices and notes as links. Open them in a new tab with rel="noopener noreferrer", allow long URLs to wrap, and keep links separate from item and choice buttons.',
	'Primary actions are buttons in one short row above the main piece. A screen has at most one filled primary button (harness audit reports overview-single-primary); the rest are secondary buttons. Labels are short verbs in sentence case, such as New project.',
	'Status is quiet. Connection, sync and account state is one short muted line or a small chip beside or below the main piece. Its details and settings open in a dialog; never stack full status panels on a landing screen.',
	'Group by job, in this order: primary actions, the main piece, quiet status. Keep to about three groups and let spacing, not borders or headings, separate them.',
	'Lists follow the approved project overview cards (n79x63): one card with a title and at most one quiet link in its header, rows with the name on the left and muted metadata on the right, hairline separators, and an empty-state line instead of a hidden card.',
	'A gate screen, such as Sign in with Google, has only its one primary action and one muted line. Nothing else is usable until it is passed.',
	'Use the shared design tokens and components: `--hx-*` tokens, Modal, Select and BrandMark. No literal colours, touch targets of at least 44px, and no horizontal overflow at 390px wide.',
	'A floating button never covers content or another control; hide it while a panel it opens, or any side panel, is open, and pad the content by its height.',
	'Absence is not failure: "not recorded" or "not measured" is muted text; red is for a failed check only.',
	'Pickers use the shared list rows, never a native list box (`select[size]`) or the system highlight.',
	'One composer: modes always read Comment · Ask · Plan · Change, whichever subset a screen offers.',
	'A gate page has one heading.',
	'Prove it in a browser: capture every changed screen and every dialog open at desktop, tablet and phone widths, and look at the images before handing work back.'
];

export const uiDesignAntiPatterns = [
	'Do not put a create or settings form on a home, list or overview screen.',
	'Do not show several full panels (connections, phone access, sign-in) one after another.',
	'Do not give a screen two filled primary buttons or a heading for every group.',
	'Do not hide a function the old screen offered; move it behind a button, dialog or quiet link.'
];

/** Shared policy emitted into tenant agent rules and the Harness skill. */
export function uiDesignRules(): string {
	return `## UI Design Patterns\n\nRead \`harness info ui-design\` before designing or changing a screen.\n\n${uiDesignPatternRules
		.map((rule) => `- ${rule}`)
		.join('\n')}\n`;
}
