import type { DesignCanvasPage } from '../../../../src/utils/planning-collaboration/designCanvas.types';
import { done, noop, type PreviewCases } from './shared';

/** SYNTHETIC artboards: two small made-up screens, drawn for either theme. */
const screen = (heading: string) =>
	'<meta name="artboard-size" content="320x240"><style>body{margin:0;padding:20px;' +
	'font-family:sans-serif;background:#fff;color:#16181d}:root[data-theme="dark"] body' +
	`{background:#101218;color:#f2f3f5}</style><h1>${heading}</h1><p>Northstar Store</p>`;
const board = (file: string, title: string, x: number) => ({
	file,
	title,
	x,
	y: 0,
	width: 320,
	height: 240,
	html: screen(title),
	problem: null
});
export const designPreviewPage: DesignCanvasPage = {
	commit: 'a'.repeat(40),
	branch: 'main',
	branches: ['main', 'feat/checkout'],
	canvases: [{ name: 'checkout', title: 'Checkout screens', artboards: 2 }],
	canvas: {
		name: 'checkout',
		title: 'Checkout screens',
		boards: [board('Basket.html', 'Basket', 0), board('Payment.html', 'Payment', 400)]
	}
};
const shown = designPreviewPage.canvas!.boards[0];
const viewer = 'reports.component.planning-collaboration-design-canvas-';

export const designCanvasCases: PreviewCases = {
	[`${viewer}artboard-frame`]: {
		board: shown,
		theme: 'dark',
		scale: 1,
		selected: true,
		onselect: noop,
		onopen: noop
	},
	[`${viewer}artboard-full`]: { board: shown, theme: 'dark', onclose: noop },
	[`${viewer}canvas-toolbar`]: {
		title: 'Checkout screens',
		scale: 0.5,
		theme: 'dark',
		selected: 'Basket',
		onzoom: noop,
		onfit: noop,
		ontheme: noop,
		onopen: noop
	},
	[`${viewer}design-canvas`]: { canvas: designPreviewPage.canvas, theme: 'dark' },
	[`${viewer}sandboxed-artboard`]: { board: shown, theme: 'light' }
};

export const hubDesignCases = (projectId: string): PreviewCases => ({
	'hub.component.planning-collaboration-designs-header': {
		projectId,
		page: designPreviewPage,
		pinned: false,
		workspace: `/projects/${projectId}/harness/pages`,
		onreload: done
	},
	'hub.component.planning-collaboration-hosted-designs': {
		projectId,
		canvas: null,
		branch: null,
		commit: null
	}
});
