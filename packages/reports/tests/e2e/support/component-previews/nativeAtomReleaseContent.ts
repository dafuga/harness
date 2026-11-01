/** Realistic caller content for release-oriented native atom previews. */
export const nativeAtomReleaseContent: Record<string, string> = {
	HtmlAside: 'Keep the previous release available for rollback.',
	HtmlBlockquote: '“Review the customer journey before publishing.”',
	HtmlCode: 'release.status === "ready"',
	HtmlDl: 'Maya Chen'
};

/** Longer copy remains meaningful while exercising wrapping at narrow widths. */
export const nativeAtomLongReleaseContent: Record<string, string> = {
	HtmlA:
		'Read the release notes for the October update, including checkout improvements and delivery tracking fixes.',
	HtmlAside:
		'Recovery notes: keep release 2.7 available until the customer portal and billing checks finish.',
	HtmlBlockquote:
		'“Ship the smallest safe change, keep the rollback ready, and verify the customer journey before opening the release to everyone.”',
	HtmlCode:
		'release.review({ branch: "main", checks: ["typecheck", "unit tests"], owner: "Maya Chen" })',
	HtmlDl:
		'Maya Chen leads the October release review for the customer portal, checkout and billing dashboard.',
	HtmlElement:
		'Release 2.8.0 is ready for review after the order search and checkout fixes passed their checks.',
	HtmlFigcaption:
		'The release dashboard shows the checkout review, delivery checks and deployment approval for October.',
	HtmlFooter:
		'Prepared by the release team. Maya Chen reviewed the changes, and Jordan Lee approved the rollout.',
	HtmlH1:
		'October release: faster checkout, clearer delivery tracking and a smoother customer portal',
	HtmlH3:
		'New features for checkout review, order search and delivery notifications in the October release',
	HtmlHeader: 'Release 2.8.0 — customer portal improvements, checkout fixes and deployment review',
	HtmlLabel: 'Public release title shown on the customer dashboard and in emailed release notes',
	HtmlMain:
		'Review the October release, inspect the completed checks, and confirm the rollout schedule with the team.',
	HtmlOl:
		'Review the checkout and delivery changes, then confirm the October release notes with the support team.',
	HtmlOutput:
		'8 files selected from the October release: checkout fixes, delivery checks and updated customer notifications.',
	HtmlPre:
		'const release = {\n  version: "2.8.0",\n  branch: "main",\n  checks: [\n    "typecheck",\n    "unit tests"\n  ]\n};\nconsole.log(release.version);',
	HtmlSmall:
		'Optional release notes help the support team answer questions about checkout changes and delivery tracking.',
	HtmlStrong:
		'Save the release notes before leaving this review so the team can approve the final customer-facing changes.',
	HtmlTable:
		'Typecheck the customer portal, checkout screens and billing dashboard before publishing release 2.8.0',
	HtmlTd:
		'Validate TypeScript types for the checkout, delivery tracking and billing changes in release 2.8.0',
	HtmlTh: 'Checks required before publishing the October release to the customer dashboard',
	HtmlTime:
		'October 20, 2026 — scheduled release review for the customer portal and billing dashboard',
	HtmlUl:
		'Confirm that checkout totals, delivery tracking and billing history behave correctly before the October release.'
};
