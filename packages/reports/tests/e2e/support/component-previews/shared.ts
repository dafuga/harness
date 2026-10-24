import type { CatalogRow } from '../../../../src/utils/entityCatalog';
import { createRawSnippet } from 'svelte';
import { formatDuration } from '../../../../src/utils/evidenceMedia';
export const noop = () => {};
export const done = async () => true;
export const text = (html = '<p>Recent activity is ready to review.</p>') =>
	createRawSnippet(() => ({ render: () => html }));
export const children = text();
export const row = createRawSnippet((item: () => { title: string }) => ({
	render: () => `<span>${item().title}</span>`
}));
export const stamp = '2026-10-20T10:00:00Z';
export const image =
	'data:image/svg+xml,' +
	encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" width="920" height="560" viewBox="0 0 920 560">
<rect width="920" height="560" fill="#0e1c29"/>
<text x="52" y="60" fill="#f3c33b" font-family="sans-serif" font-size="20">SYNTHETIC PREVIEW INPUT</text>
<text x="52" y="124" fill="#f4f7fb" font-family="sans-serif" font-size="36">Order card</text>
<g fill="#d8e4ee" font-family="sans-serif" font-size="24">
<text x="52" y="206">Order #1048</text><text x="650" y="206">$128.00</text>
<text x="52" y="266">Customer: Alex Example</text>
<text x="52" y="326">Status: Ready to ship</text>
</g><text x="52" y="480" fill="#92a6bb" font-family="sans-serif" font-size="20">Fictional input for image-viewer and card fixtures.</text></svg>`
	);
/** Fictional layout input, distinct from the orders page and card fixture images. */
export const layoutImage = `<svg xmlns="http://www.w3.org/2000/svg" width="920" height="560" viewBox="0 0 920 560">
<rect width="920" height="560" fill="#0e1c29"/>
<text x="40" y="48" fill="#f3c33b" font-family="sans-serif" font-size="18">SYNTHETIC LAYOUT INPUT</text>
<text x="40" y="94" fill="#f4f7fb" font-family="sans-serif" font-size="28">OrdersFrame</text>
<path d="M0 120H920" stroke="#30495f"/>
<rect x="40" y="152" width="840" height="368" rx="12" fill="#142b3e" stroke="#f3c33b" stroke-width="2" stroke-dasharray="8 6"/>
<text x="460" y="326" text-anchor="middle" fill="#f3c33b" font-family="sans-serif" font-size="32">Child content</text>
<text x="460" y="366" text-anchor="middle" fill="#d8e4ee" font-family="sans-serif" font-size="22">Your page renders here</text></svg>`;
export const example = {
	name: 'Format a duration',
	description: 'Turns seconds into display text.',
	call: 'formatDuration(90)',
	output: formatDuration(90),
	input: { seconds: 90 }
};
export const models = [
	{
		provider: 'openai',
		model: 'gpt-6.1',
		label: 'GPT 6.1',
		efforts: ['high'],
		defaultEffort: 'high',
		source: 'local-catalog'
	},
	{
		provider: 'harness-claude',
		model: 'claude-opus-5-5',
		label: 'Claude Opus 5.5',
		efforts: ['xhigh'],
		defaultEffort: 'xhigh',
		source: 'local-catalog'
	}
];
export const activeSelection = { provider: 'openai', model: 'gpt-6.1', effort: 'high' };
export const targetSelection = {
	provider: 'harness-claude',
	model: 'claude-opus-5-5',
	effort: 'xhigh'
};
export const picker = {
	models,
	defaultProvider: 'openai',
	sessionId: 'preview-session',
	active: { selection: activeSelection, idle: true, clients: 1, observedAt: stamp },
	request: {
		id: 'preview-switch',
		sessionId: 'preview-session',
		target: targetSelection,
		status: 'pending',
		createdAt: stamp,
		reason: ''
	},
	controlConnected: true,
	message: ''
};

export type { PreviewProps, PreviewCases } from './shared.types';

/** The list an index is given: synthetic names alone, since each card has a preview of its own. */
export const names = createRawSnippet((listed: () => CatalogRow[]) => ({
	render: () =>
		'<ul>' +
		listed()
			.map((row) => `<li>${row.name}</li>`)
			.join('') +
		'</ul>'
}));
