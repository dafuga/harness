import { createRawSnippet } from 'svelte';
export type PreviewProps = Record<string, unknown>;
export type PreviewCases = Record<string, PreviewProps>;
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
		'<svg xmlns="http://www.w3.org/2000/svg" width="920" height="560" viewBox="0 0 920 560"><rect width="920" height="560" fill="#0e1c29"/><text x="52" y="74" fill="#f4f7fb" font-family="sans-serif" font-size="30">Recent activity</text><g fill="#d8e4ee" font-family="sans-serif" font-size="22"><text x="52" y="144">✓ Review component states</text><text x="52" y="202">✓ Capture screenshots</text><text x="52" y="260">✓ Check keyboard navigation</text></g><rect x="52" y="310" width="246" height="48" rx="8" fill="#254153"/><text x="72" y="342" fill="white" font-family="sans-serif" font-size="18">Show all 7 activities</text></svg>'
	);
export const example = {
	name: 'Format a duration',
	description: 'Turns seconds into display text.',
	call: 'formatDuration(90)',
	output: '"1:30"',
	input: { seconds: 90 },
	result: '1:30'
};
export const models = [
	{
		provider: 'openai',
		model: 'gpt-6.1',
		label: 'GPT 6.1',
		efforts: ['high'],
		defaultEffort: 'high'
	},
	{
		provider: 'harness-claude',
		model: 'claude-opus-5-5',
		label: 'Claude Opus 5.5',
		efforts: ['xhigh'],
		defaultEffort: 'xhigh'
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
	}
};
