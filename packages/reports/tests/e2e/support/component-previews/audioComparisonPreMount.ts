import { resolve } from 'node:path';
import { baselineNarration, releaseNarration } from './reportData';

let rendered: Promise<string> | undefined;

/** Render the actual component on the server, where onMount has not enabled its button. */
export function audioComparisonPreMount() {
	return (rendered ??= renderAudioComparison());
}

async function renderAudioComparison() {
	const { createServer } = await import('vite');
	const server = await createServer({
		configFile: resolve('vite.config.ts'),
		server: { middlewareMode: true },
		appType: 'custom'
	});
	try {
		const { default: AudioComparison } = await server.ssrLoadModule(
			'/src/components/reports-media/AudioComparison.svelte'
		);
		const { render } = await server.ssrLoadModule('svelte/server');
		const { body } = render(AudioComparison, {
			props: { before: baselineNarration, after: releaseNarration, onopen: () => {} }
		});
		return `<div class="preview-catalog hx-shell"><main class="preview-main hx-main gallery-section"><h1 id="preview-title">Audio comparison</h1><div class="preview-content evidence-grid" data-preview-unit="reports.component.audio-comparison" data-preview-frame="component">${body}</div></main></div>`;
	} finally {
		await server.close();
	}
}
