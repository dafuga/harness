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
		'Opacity',
		'Motion',
		'Layering',
		'Layout tokens',
		'Responsive breakpoints'
	],
	designProperties:
		/^(?:color|background(?:-.+)?|border(?:-.+)?|outline(?:-.+)?|fill|stroke|font(?:-.+)?|line-height|letter-spacing|text-shadow|box-shadow|padding(?:-.+)?|margin(?:-.+)?|(?:row-|column-)?gap|opacity|z-index|transition(?:-.+)?|animation-duration|animation-delay|animation-timing-function)$/,
	typographyProperties: /^(?:font(?:-.+)?|line-height|letter-spacing)$/
} as const;
