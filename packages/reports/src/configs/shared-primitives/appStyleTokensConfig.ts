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
		Colors: 'The thirteen palette colors, and treatments mixed only from them.',
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
	/** The color a component names for each job, as `[variable, what it paints]`. Gold and plain are
	 *  the two tones of HarnessAction; the blue accent informs and never fills an action. */
	colorRoles: [
		{
			name: 'Primary',
			use: 'the main action of a view (HarnessAction gold) and selected or checked states.',
			tokens: [
				['--hx-gold', 'Action label and border, selected marks'],
				['--hx-gold-soft', 'Hover fill behind gold text'],
				['--hx-gold-ink', 'Text on a solid gold fill']
			]
		},
		{
			name: 'Secondary',
			use: 'supporting actions beside the main one (HarnessAction plain). Keep them neutral.',
			tokens: [
				['--hx-line-strong', 'Plain action border'],
				['--hx-text', 'Plain action label'],
				['--hx-tint-hover', 'Plain action hover fill']
			]
		},
		{
			name: 'Surfaces and backgrounds',
			use: 'stacking page, panel and raised layers; separate them with lines, not new shades.',
			tokens: [
				['--hx-bg', 'The page, code blocks and media wells'],
				['--hx-surface', 'Panels, cards and sections'],
				['--hx-raised', 'Inputs, notices and layers inside a panel'],
				['--hx-line', 'Dividers and panel borders'],
				['--hx-scrim', 'Backdrop behind a dialog']
			]
		},
		{
			name: 'Text hierarchy',
			use: 'ranking copy: headings and values, then body text, then captions and metadata.',
			tokens: [
				['--hx-text', 'Headings, values and key labels'],
				['--hx-soft', 'Body and supporting copy'],
				['--hx-muted', 'Captions, metadata and counts']
			]
		},
		{
			name: 'Success',
			use: 'passed checks and completed proof. Pair the color with its soft fill and line.',
			tokens: [
				['--hx-pass', 'Text and icons'],
				['--hx-pass-soft', 'Fill behind that text'],
				['--hx-pass-line', 'Border around that fill']
			]
		},
		{
			name: 'Warning',
			use: 'blocked, unproven or interrupted work that needs attention but has not failed.',
			tokens: [
				['--hx-warning', 'Text and icons'],
				['--hx-warning-soft', 'Fill behind that text'],
				['--hx-warning-line', 'Border around that fill']
			]
		},
		{
			name: 'Error and danger',
			use: 'failed checks, errors and broken states that stopped the work.',
			tokens: [
				['--hx-fail', 'Text and icons'],
				['--hx-danger-soft', 'Fill behind that text'],
				['--hx-danger-line', 'Border around that fill']
			]
		},
		{
			name: 'Information and focus',
			use: 'keyboard focus, running work and informative highlights; never an action fill.',
			tokens: [
				['--hx-accent', 'Focus rings, running text and icons'],
				['--hx-accent-soft', 'Fill behind running text'],
				['--hx-accent-line', 'Running and informative borders']
			]
		}
	],
	designProperties:
		/^(?:color|background(?:-.+)?|border(?:-.+)?|outline(?:-.+)?|fill|stroke|font(?:-.+)?|line-height|letter-spacing|text-shadow|box-shadow|filter|backdrop-filter|accent-color|caret-color|scrollbar-color|text-decoration(?:-.+)?|border-spacing|padding(?:-.+)?|margin(?:-.+)?|(?:row-|column-)?gap|opacity|z-index|transition(?:-.+)?|animation(?:-.+)?)$/,
	typographyProperties: /^(?:font(?:-.+)?|line-height|letter-spacing)$/
} as const;
