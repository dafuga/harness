/** The tokens each group owns, in the order Styles shows them: the purpose-named choices first, then
 *  the foundation scales they draw from. */
const groupPrefixes = {
	Colors: /^--hx-color-/,
	Typography: /^--hx-(?:font-family-(?:body|heading|code)|type-size-(?:body|heading|caption))$/,
	'Spacing and corners': /^--hx-(?:space-(?:section|control|inline)|radius-(?:control|panel))$/,
	Shadows: /^--hx-shadow-/,
	Motion: /^--hx-motion-/,
	Layering: /^--hx-layer-/,
	Layout: /^--hx-(?:gutter$|nav-|layout-)/,
	'Type scale': /^--hx-type-size-/,
	'Text styles': /^--hx-style-/,
	'Spacing scale': /^--hx-space-/,
	'Borders and corners': /^--hx-(?:border|radius)(?:-|$)/,
	'Effects and opacity': /^--hx-(?:effect|opacity)-/,
	'Responsive breakpoints': /^--hx-breakpoint-/
} as const;

/** App-wide design decisions live in one stylesheet, shared by every renderer. */
export const appStyleTokensConfig = {
	roots: ['packages/reports/src', 'packages/desktop/src', 'packages/hub/src'],
	tokenFile: 'packages/reports/src/lib/styles/app-tokens.css',
	groups: Object.keys(groupPrefixes) as (keyof typeof groupPrefixes)[],
	/** The first group of the foundation inventory, listed compactly after the choices. */
	foundation: 'Type scale',
	/** Legacy CSS aliases stay valid for existing consumers, but are not catalog choices. */
	legacyAliases: /^--hx-(?:bg|gold|muted|font-family-sans)$/,
	/** A token name no group claims stays unclassified. */
	groupPrefixes,
	groupDescriptions: {
		Colors:
			'One base variable per purpose, then treatments mixed from it: -soft fills behind its text, -line borders that fill, -wash glows, -tint fills checked controls, and direct, indirect, added and removed paint change-map nodes.',
		Typography: 'The typefaces and sizes to read for body text, headings, code and captions.',
		'Spacing and corners': 'The gaps and corners to read for page sections, controls and panels.',
		Shadows: 'Elevation of popovers to sheets, and the outline, halo and selection rings.',
		Motion: 'Hover, reveal, stagger, spinner and pulse durations, and their easing.',
		Layering: 'Stacking order of raised content, dropdowns, sticky bars, popovers and overlays.',
		Layout: 'Page gutters, navigation gaps, and clearances for bars, dialogs and zoomed views.',
		'Type scale': 'Every font size the typography choices draw from.',
		'Text styles': 'Weights, styles, leading, tracking, numerals and whole font shorthands.',
		'Spacing scale': 'Every padding, margin and gap length, named by its size in pixels.',
		'Borders and corners': 'Border widths and the corner radii the corner choices draw from.',
		'Effects and opacity': 'Blur and hover treatments, and the translucency of quieter content.',
		'Responsive breakpoints': 'Reference widths, repeated literally by media queries.'
	},
	/** What each choice is for, the one variable that assigns it, and where the apps read it. A
	 *  color's treatments are subordinate states of its base variable, never a second base. */
	roles: {
		Colors: [
			{
				name: 'Primary',
				use: 'the main action of a view, the current selection and checked controls.',
				where:
					'Primary actions, the current navigation item and tab, checked switches, focused fields, the brand mark, selected map nodes and Desktop focus rings.',
				base: '--hx-color-primary',
				tokens: [
					'--hx-color-primary-soft',
					'--hx-color-primary-tint',
					'--hx-color-primary-wash',
					'--hx-color-primary-line',
					'--hx-color-primary-light',
					'--hx-color-primary-contrast',
					'--hx-color-direct'
				]
			},
			{
				name: 'Secondary',
				use: 'supporting controls beside the main action: the outline around a plain label.',
				where:
					'Outlines of Desktop and Hub buttons, outline links, inputs, selects and textareas, and of the Reports search field and switch track.',
				base: '--hx-color-secondary'
			},
			{
				name: 'Tertiary',
				use: 'a contrasting accent that marks where keyboard focus is.',
				where: 'The Reports keyboard focus ring.',
				base: '--hx-color-tertiary'
			},
			{
				name: 'Success',
				use: 'passed checks and completed proof.',
				where: 'Passed badges and verdicts, proof and provider rules, finished deployment steps.',
				base: '--hx-color-success',
				tokens: ['--hx-color-success-soft', '--hx-color-success-line', '--hx-color-added']
			},
			{
				name: 'Warning',
				use: 'blocked, unproven or interrupted work that needs attention but has not failed.',
				where: 'Blocked badges, unproven notices, audio and replay warnings, project activity.',
				base: '--hx-color-warning',
				tokens: ['--hx-color-warning-soft', '--hx-color-warning-line']
			},
			{
				name: 'Error',
				use: 'failed checks, errors and broken states that stopped the work.',
				where: 'Failed badges and verdicts, error messages and notices, failed deployment steps.',
				base: '--hx-color-error',
				tokens: ['--hx-color-error-soft', '--hx-color-error-line', '--hx-color-removed']
			},
			{
				name: 'Info',
				use: 'running work and informative highlights; never an action fill.',
				where: 'Running badges, numeric config values, proof links and deployment targets.',
				base: '--hx-color-info',
				tokens: ['--hx-color-info-soft', '--hx-color-info-line', '--hx-color-indirect']
			},
			{
				name: 'Background',
				use: 'the page under everything; its treatments shade what sits behind dialogs and shadows.',
				where: 'The page of every app, the Desktop and Hub top bar, and code and media wells.',
				base: '--hx-color-background',
				tokens: ['--hx-color-scrim', '--hx-color-scrim-strong', '--hx-color-shadow']
			},
			{
				name: 'Surface',
				use: 'panels, cards and bars on the background; raised layers and row states sit on it.',
				where: 'The Reports navigation bar, cards, notices and search field, and Hub cards.',
				base: '--hx-color-surface',
				tokens: ['--hx-color-surface-raised', '--hx-color-hover', '--hx-color-selected']
			},
			{
				name: 'Text',
				use: 'headings, values and key labels; quieter levels rank body copy, then captions.',
				where: 'The default text of Reports, Desktop and Hub, and the current breadcrumb.',
				base: '--hx-color-text',
				tokens: ['--hx-color-text-supporting', '--hx-color-text-muted']
			},
			{
				name: 'Border',
				use: 'dividers and panel edges; separate layers with lines, not new shades.',
				where: 'Navigation and top bar edges, cards, tables and the rules inside Styles cards.',
				base: '--hx-color-border',
				tokens: ['--hx-color-border-strong']
			}
		],
		Typography: [
			{
				name: 'Body text',
				base: '--hx-font-family-body',
				where: 'Reports .hx-shell and the Desktop, iOS and Hub root, so all text that inherits.'
			},
			{
				name: 'Headings',
				base: '--hx-font-family-heading',
				where: 'Desktop and Hub h1 to h3 and the Styles headings; it follows the body typeface.'
			},
			{
				name: 'Code',
				base: '--hx-font-family-code',
				where: 'Code, hashes, paths and recorded values in every app, and .hx-mono text.'
			},
			{
				name: 'Body size',
				base: '--hx-type-size-body',
				where: 'Reports .hx-shell and the Desktop and Hub body, so all text that inherits.'
			},
			{
				name: 'Heading size',
				base: '--hx-type-size-heading',
				where: 'Desktop and Hub h2 section headings, and the Styles group headings.'
			},
			{
				name: 'Caption size',
				base: '--hx-type-size-caption',
				where: 'Desktop and Hub small and .muted text, and the kicker and values on Styles.'
			}
		],
		'Spacing and corners': [
			{
				name: 'Section spacing',
				base: '--hx-space-section',
				where: 'The gap between the sections of the Styles page.'
			},
			{
				name: 'Control padding',
				base: '--hx-space-control',
				where: 'Inline padding of Desktop and Hub controls and of the Reports search field.'
			},
			{
				name: 'Inline gap',
				base: '--hx-space-inline',
				where: 'Desktop and Hub rows, and the Reports brand, search field and switch.'
			},
			{
				name: 'Control corners',
				base: '--hx-radius-control',
				where: 'Desktop and Hub buttons, outline links, inputs, selects and textareas.'
			},
			{
				name: 'Panel corners',
				base: '--hx-radius-panel',
				where: 'Reports .hx-card panels and the Styles cards.'
			}
		]
	},
	/** Where a token of a role group that no role lists is shown, so it never goes missing. */
	unassigned: { name: 'Unassigned', use: 'nothing until a role above lists it.' },
	designProperties:
		/^(?:color|background(?:-.+)?|border(?:-.+)?|outline(?:-.+)?|fill|stroke|font(?:-.+)?|line-height|letter-spacing|text-shadow|box-shadow|filter|backdrop-filter|accent-color|caret-color|scrollbar-color|text-decoration(?:-.+)?|border-spacing|padding(?:-.+)?|margin(?:-.+)?|(?:row-|column-)?gap|opacity|z-index|transition(?:-.+)?|animation(?:-.+)?)$/,
	typographyProperties: /^(?:font(?:-.+)?|line-height|letter-spacing)$/
} as const;
