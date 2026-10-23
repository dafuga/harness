/** App-wide design decisions live in one stylesheet, shared by every renderer. */
export const appStyleTokensConfig = {
	roots: ['packages/reports/src', 'packages/desktop/src', 'packages/hub/src'],
	tokenFile: 'packages/reports/src/lib/styles/app-tokens.css',
	groups: [
		'Colors',
		'Font families',
		'Type scale',
		'Text styles',
		'Spacing',
		'Borders and corners',
		'Shadows',
		'Effects',
		'Opacity',
		'Motion',
		'Layering',
		'Layout tokens',
		'Responsive breakpoints'
	],
	/** The token prefixes each declared group owns; a name none of them claims stays unclassified. */
	groupPrefixes: {
		Colors:
			/^--hx-(?:bg|surface|raised|line|text|soft|muted|gold|pass|fail|accent|danger|warning|tint|scrim)(?:-|$)/,
		'Font families': /^--hx-font-family-/,
		'Type scale': /^--hx-type-size-/,
		'Text styles': /^--hx-style-/,
		Spacing: /^--hx-space-/,
		'Borders and corners': /^--hx-(?:border|radius)(?:-|$)/,
		Shadows: /^--hx-shadow-/,
		Effects: /^--hx-effect-/,
		Opacity: /^--hx-opacity-/,
		Motion: /^--hx-motion-/,
		Layering: /^--hx-layer-/,
		'Layout tokens': /^--hx-(?:gutter$|nav-|layout-)/,
		'Responsive breakpoints': /^--hx-breakpoint-/
	},
	groupDescriptions: {
		Colors: 'Every color variable once, under its role: a base color, then its treatments.',
		'Font families': 'Inter for interface text, and a named monospace stack for code.',
		'Type scale': 'Fixed font sizes, fluid title sizes, and inline text sized to its parent.',
		'Text styles': 'Weights, styles, leading, tracking, numerals and whole font shorthands.',
		Spacing: 'Padding, margin and gap lengths, each named by its size in pixels.',
		'Borders and corners': 'Border widths and corner radii.',
		Shadows: 'Elevation and outline rings, painted with the shared shadow tint.',
		Effects: 'Blur and brightness treatments shared by dialogs, galleries and chat.',
		Opacity: 'Translucency of faint, disabled and secondary content.',
		Motion: 'Transition and animation durations and easing functions.',
		Layering: 'Stacking order, from behind content to a full-screen view.',
		'Layout tokens': 'Gutters, navigation gaps and structural clearances.',
		'Responsive breakpoints': 'Reference widths, repeated literally by media queries.'
	},
	/** Each color variable under the one role that owns it, as `[variable, what it paints]`. A role
	 *  with a hue names one base color; its other variables are treatments of it, not more hues. Gold
	 *  and plain are the two tones of HarnessAction; the blue accent informs and never fills an action.
	 *  A role may name in `use` a variable that another role owns and lists. */
	colorRoles: [
		{
			name: 'Primary',
			use: 'the main action of a view (HarnessAction gold) and selected or checked states. Gold is the one primary color; its treatments pair with it and are never a second primary.',
			base: ['--hx-gold', 'Action label and border, selected marks and checked controls'],
			tokens: [
				['--hx-gold-soft', 'Hover fill of a gold action and an active tab'],
				['--hx-gold-tint', 'Checked toggle fill and the halo of an active light'],
				['--hx-gold-wash', 'Faint glow behind active media, callouts and choices'],
				['--hx-gold-line', 'Gold borders and rules beside content'],
				['--hx-gold-fill', 'Opaque fill on the page color, such as direct map nodes'],
				['--hx-gold-light', 'Notice text and the light end of a gold gradient'],
				['--hx-gold-ink', 'Text on a solid gold fill']
			]
		},
		{
			name: 'Secondary',
			use: 'supporting actions beside the main one (HarnessAction plain): a --hx-text label with these neutral variables. Secondary has no hue of its own.',
			base: null,
			tokens: [
				['--hx-line-strong', 'Plain action, input and field borders'],
				['--hx-tint-hover', 'Plain action hover fill'],
				['--hx-tint-selected', 'Selected and hovered row fill']
			]
		},
		{
			name: 'Surfaces and backgrounds',
			use: 'stacking page, panel and raised layers; separate them with lines, not new shades.',
			base: null,
			tokens: [
				['--hx-bg', 'The page, code blocks and media wells'],
				['--hx-surface', 'Panels, cards and sections'],
				['--hx-raised', 'Inputs, notices and layers inside a panel'],
				['--hx-line', 'Dividers and panel borders'],
				['--hx-scrim', 'Backdrop behind a dialog'],
				['--hx-scrim-strong', 'Media viewer backdrop and labels laid over media'],
				['--hx-tint-shadow', 'The shade every shared shadow casts']
			]
		},
		{
			name: 'Text hierarchy',
			use: 'ranking copy: headings and values, then body text, then captions and metadata.',
			base: null,
			tokens: [
				['--hx-text', 'Headings, values and key labels'],
				['--hx-soft', 'Body and supporting copy'],
				['--hx-muted', 'Captions, metadata and counts']
			]
		},
		{
			name: 'Success',
			use: 'passed checks and completed proof. Pair the color with its soft fill and line.',
			base: ['--hx-pass', 'Text and icons'],
			tokens: [
				['--hx-pass-soft', 'Fill behind that text'],
				['--hx-pass-line', 'Border around that fill'],
				['--hx-pass-fill', 'Opaque fill on the page color, such as added map nodes']
			]
		},
		{
			name: 'Warning',
			use: 'blocked, unproven or interrupted work that needs attention but has not failed.',
			base: ['--hx-warning', 'Text and icons'],
			tokens: [
				['--hx-warning-soft', 'Fill behind that text'],
				['--hx-warning-line', 'Border around that fill']
			]
		},
		{
			name: 'Error and danger',
			use: 'failed checks, errors and broken states that stopped the work.',
			base: ['--hx-fail', 'Text and icons'],
			tokens: [
				['--hx-danger-soft', 'Fill behind that text'],
				['--hx-danger-line', 'Border around that fill'],
				['--hx-fail-fill', 'Opaque fill on the page color, such as removed map nodes']
			]
		},
		{
			name: 'Information and focus',
			use: 'keyboard focus, running work and informative highlights; never an action fill.',
			base: ['--hx-accent', 'Focus rings, running text and icons'],
			tokens: [
				['--hx-accent-soft', 'Fill behind running text'],
				['--hx-accent-line', 'Running and informative borders'],
				['--hx-accent-fill', 'Opaque fill on the page color, such as indirect map nodes']
			]
		}
	],
	/** Where a color variable that no role lists is shown, so a new color never goes missing. */
	unassignedColors: {
		name: 'Unassigned colors',
		use: 'nothing until a role above lists it, with what it paints.'
	},
	designProperties:
		/^(?:color|background(?:-.+)?|border(?:-.+)?|outline(?:-.+)?|fill|stroke|font(?:-.+)?|line-height|letter-spacing|text-shadow|box-shadow|filter|backdrop-filter|accent-color|caret-color|scrollbar-color|text-decoration(?:-.+)?|border-spacing|padding(?:-.+)?|margin(?:-.+)?|(?:row-|column-)?gap|opacity|z-index|transition(?:-.+)?|animation(?:-.+)?)$/,
	typographyProperties: /^(?:font(?:-.+)?|line-height|letter-spacing)$/
} as const;
