import type { HarnessIconName } from './harnessIcons.types';
import type { ExplorerCategory } from '../../models/explorer-ui/Explorer.types';

/**
 * The one icon set of the explorer: each icon is path data on a 24 by 24 grid, drawn as an
 * outline in the colour of the text around it. The two verdicts alone are solid discs.
 */
const cube = 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM4 7.5l8 4.5 8-4.5M12 12v9';
const sheet = 'M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM14 3v5h5';
const disc = 'M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20z';
const ring = 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 0 0 0-17z';
const cylinder =
	'M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3zM5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6' +
	'M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6';
const cog =
	'M9.7 5.3L10.4 2.8L13.6 2.8L14.3 5.3L15.1 5.6L17.3 4.4L19.6 6.7L18.4 8.9L18.7 9.7L21.2 10.4' +
	'L21.2 13.6L18.7 14.3L18.4 15.1L19.6 17.3L17.3 19.6L15.1 18.4L14.3 18.7L13.6 21.2L10.4 21.2' +
	'L9.7 18.7L8.9 18.4L6.7 19.6L4.4 17.3L5.6 15.1L5.3 14.3L2.8 13.6L2.8 10.4L5.3 9.7L5.6 8.9' +
	'L4.4 6.7L6.7 4.4L8.9 5.6z';

export const harnessIcons = {
	// Entity categories.
	pages:
		'M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 8h8M8 12h8M8 16h5',
	// A frame: the bar across the top, a side and the content beside it.
	layouts: 'M3 4h18v16H3zM3 9h18M8 9v11',
	components: cube,
	styles:
		'M12 3a9 9 0 1 0 0 18h1.2a2.2 2.2 0 0 0 1.6-3.7c-.8-.8-.2-2.3 1-2.3H18a3 3 0 0 0 3-3a9 9 0 0 0-9-9zM7.5 12.5h.1M10 8h.1M14 7.5h.1M17 10h.1',
	functions:
		'M3.5 20c2 0 2.7-1 3.1-3L9 6.6C9.4 4.7 10.3 4 12 4M5.5 10.5h7M14.5 13l5 6M19.5 13l-5 6',
	configs: `${cog}M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6z`,
	services: 'M12 4l8 4.5-8 4.5-8-4.5L12 4zM4 13.5L12 18l8-4.5',
	// A screen with a phone in front of it: every place the app is built for.
	platforms:
		'M12 15H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3M8 19h4M10 15v4' +
		'M16 10h4a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z',
	// The platforms themselves: a globe, a handset, the Android head and a monitor.
	web:
		`${ring}M3.5 12h17M12 3.5c2.3 2.3 3.5 5.1 3.5 8.5s-1.2 6.2-3.5 8.5` +
		'M12 3.5C9.7 5.8 8.5 8.6 8.5 12s1.2 6.2 3.5 8.5',
	phone:
		'M8.5 3h7A1.5 1.5 0 0 1 17 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19.5v-15' +
		'A1.5 1.5 0 0 1 8.5 3zM11 18h2',
	android: 'M5 16a7 7 0 0 1 14 0zM8.3 10.1L6.8 7.6M15.7 10.1L17.2 7.6M9.5 13.2v.1M14.5 13.2v.1',
	desktop:
		'M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 20h7M12 16v4',
	// The two verdicts: a disc with a check cut out of it, and one with a cross.
	passed: `${disc}M10.6 16.8l-4.3-4.3 1.4-1.4 2.9 2.9 5.7-5.7 1.4 1.4z`,
	failed: `${disc}M15.5 7.1l1.4 1.4L13.4 12l3.5 3.5-1.4 1.4L12 13.4l-3.5 3.5-1.4-1.4L10.6 12 7.1 8.5l1.4-1.4L12 10.6z`,
	// Contracts, measurements and evidence.
	contract: `${sheet}M9 13h6M9 17h6`,
	file: sheet,
	size: `${cube}M8 5.3l8 4.5`,
	performance: 'M4 20v-6h4v6zM10 20V5h4v15zM16 20v-9h4v9zM3 20h18',
	gauge: 'M4.5 17a8.5 8.5 0 1 1 15 0M12 13l3.5-4M12 14.2a1.2 1.2 0 1 0 0-2.4a1.2 1.2 0 0 0 0 2.4z',
	layers: 'M12 3l9 4.5-9 4.5-9-4.5L12 3zM3 12l9 4.5 9-4.5M3 16.5L12 21l9-4.5',
	tests: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.5 15h9',
	history: 'M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5M3.5 4v4.5H8M12 7.5V12l3 2',
	relationships: 'M9 3h6v5H9zM3 16h6v5H3zM15 16h6v5h-6zM12 8v4M6 16v-4h12v4',
	environment: cylinder,
	database: cylinder,
	shield: 'M12 3l7.5 3v5.5c0 4.6-3.1 8-7.5 9.5-4.4-1.5-7.5-4.9-7.5-9.5V6L12 3z',
	fixture:
		'M6 4h12a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM9 9h6M9 13h6M9 17h3',
	state: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 5v4M8 15v4',
	route:
		'M6 20a2 2 0 1 0 0-4a2 2 0 0 0 0 4zM18 8a2 2 0 1 0 0-4a2 2 0 0 0 0 4z' +
		'M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7',
	clock: `${ring}M12 7.5V12l3 2`,
	// Values as written: an object in braces, an array in brackets and any other expression.
	object:
		'M8.5 4H8a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h.5' +
		'M15.5 4h.5a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-.5',
	array: 'M8.5 4H5v16h3.5M15.5 4H19v16h-3.5',
	code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4.5l-3 15',
	// The revision that is viewed.
	branch:
		'M6 7a2 2 0 1 0 0-4a2 2 0 0 0 0 4zM6 21a2 2 0 1 0 0-4a2 2 0 0 0 0 4z' +
		'M18 10a2 2 0 1 0 0-4a2 2 0 0 0 0 4zM6 7v10M18 10c0 4.5-12 2.5-12 7',
	commit: 'M12 15.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7zM12 2.5v6M12 15.5v6',
	// Controls.
	'arrow-right': 'M4 12h16M14 6l6 6-6 6',
	'arrow-left': 'M20 12H4M10 6l-6 6 6 6',
	'chevron-right': 'M9 5l7 7-7 7',
	'chevron-down': 'M5 9l7 7 7-7',
	search: 'M10.5 17a6.5 6.5 0 1 0 0-13a6.5 6.5 0 0 0 0 13zM15.5 15.5L21 21',
	close: 'M5 5l14 14M19 5L5 19',
	external: 'M14 4h6v6M20 4l-9 9M18 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5.5',
	expand: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
	help: `${ring}M9.6 9.5a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8M12 16.6v.1`,
	info: `${ring}M12 11v5.5M12 7.6v.1`,
	grid: 'M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z',
	list: 'M8.5 6H20M8.5 12H20M8.5 18H20M4 6h.5M4 12h.5M4 18h.5',
	link:
		'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2' +
		'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2',
	change: 'M4 8h13M13 4l4 4-4 4M20 16H7M11 12l-4 4 4 4',
	'check-square':
		'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8 12l3 3 5-6',
	// A place where something could be and nothing is.
	empty:
		'M4 8V5a1 1 0 0 1 1-1h3M11 4h2M16 4h3a1 1 0 0 1 1 1v3M20 11v2M20 16v3a1 1 0 0 1-1 1h-3' +
		'M13 20h-2M8 20H5a1 1 0 0 1-1-1v-3M4 13v-2'
} as const satisfies Record<string, string>;

/** The icons that are filled, not outlined: a verdict is read by its colour and its shape. */
export const solidIcons: ReadonlySet<HarnessIconName> = new Set(['passed', 'failed']);

/** The icon each category has in the bar, in the lists and at the head of an entity. */
export const categoryIcon: Record<ExplorerCategory, HarnessIconName> = {
	pages: 'pages',
	apis: 'route',
	layouts: 'layouts',
	components: 'components',
	functions: 'functions',
	configs: 'configs',
	services: 'services',
	models: 'database',
	types: 'code',
	platforms: 'platforms'
};

export type { HarnessIconName } from './harnessIcons.types';
