import { resolve } from 'node:path';

let rendered: Promise<string> | undefined;

/** Render the actual uploader before onMount enables submission. */
export function uploadComparisonPreMount() {
	return (rendered ??= renderUploadComparison());
}

async function renderUploadComparison() {
	const { createServer } = await import('vite');
	const server = await createServer({
		configFile: resolve('vite.config.ts'),
		// Match the production fixture's Svelte CSS hashes in the server-rendered markup.
		server: { middlewareMode: true, hmr: false },
		appType: 'custom'
	});
	try {
		const { default: UploadComparison } = await server.ssrLoadModule(
			'/src/components/shared-primitives/UploadComparison.svelte'
		);
		const { render } = await server.ssrLoadModule('svelte/server');
		const { body } = render(UploadComparison, {
			props: { reportId: 'preview-report', onUploaded: () => {} }
		});
		return `<div class="preview-catalog hx-shell"><main class="preview-main hx-main"><h1 id="preview-title">Screenshot comparison upload</h1><div class="preview-content" data-preview-unit="reports.component.upload-comparison" data-preview-frame="component">${body}</div></main></div>`;
	} finally {
		await server.close();
	}
}
