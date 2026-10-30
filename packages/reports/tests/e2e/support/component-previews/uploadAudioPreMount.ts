import { resolve } from 'node:path';

let rendered: Promise<string> | undefined;

/** Render the real audio uploader before mount, with production fixture CSS hashes. */
export function uploadAudioPreMount() {
	return (rendered ??= renderUploadAudio());
}

async function renderUploadAudio() {
	const { createServer } = await import('vite');
	const server = await createServer({
		configFile: resolve('vite.config.ts'),
		server: { middlewareMode: true, hmr: false },
		appType: 'custom'
	});
	try {
		const { default: UploadAudio } = await server.ssrLoadModule(
			'/src/components/reports-media/UploadAudio.svelte'
		);
		const { render } = await server.ssrLoadModule('svelte/server');
		const { body } = render(UploadAudio, {
			props: { reportId: 'preview-report', onUploaded: () => {} }
		});
		return `<div class="preview-catalog hx-shell"><main class="preview-main hx-main"><h1 id="preview-title">Audio evidence upload</h1><div class="preview-content" data-preview-unit="reports.component.upload-audio" data-preview-frame="component">${body}</div></main></div>`;
	} finally {
		await server.close();
	}
}
