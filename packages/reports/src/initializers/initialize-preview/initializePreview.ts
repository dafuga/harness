import { previewNode } from '../../utils/previewNode';
import { previewHealth, closePreviewSessions } from './previewHealth';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { PreviewServerService } from '../../services/preview-server-service/PreviewServerService';
import { previewArguments } from '../../utils/previewArguments';
import { previewOwnerPort } from '../../utils/previewOwner';

/** Reports and the desktop renderer share one managed preview across all checkouts. */
export async function initializePreview(args: string[] = process.argv.slice(2)): Promise<void> {
	const options = previewArguments(args),
		port = Number(process.env.HARNESS_PREVIEW_OWNER_PORT ?? previewOwnerPort);
	if (!Number.isInteger(port) || port < 1024 || port > 65535)
		throw new Error('Invalid preview ownership port.');
	const owner = new PreviewServerService(port);
	const token = process.env.HARNESS_PREVIEW_WORKER_TOKEN;
	let worker: { close(): Promise<void> } | undefined;
	const quit = () => {
		closePreviewSessions();
		void (worker ? worker.close() : owner.close()).finally(() => process.exit());
	};
	process.once('SIGTERM', quit);
	process.once('SIGINT', quit);
	try {
		const start = async () => {
			const server = await createServer({
				root: options.root,
				plugins: token ? [previewHealth(token)] : [],
				configFile: options.configFile,
				server: { host: '127.0.0.1', port: options.port, strictPort: true }
			});
			try {
				await server.listen();
			} catch (error) {
				await server.close();
				throw error;
			}
			return { url: `http://127.0.0.1:${options.port}`, close: () => server.close() };
		};
		const result = token
			? { ...(worker = await start()), reused: false }
			: await owner.run(options.identity, start);
		console.log(`${result.reused ? 'Reusing Harness preview' : 'Harness preview'}: ${result.url}`);
		if (result.reused) {
			process.removeListener('SIGTERM', quit);
			process.removeListener('SIGINT', quit);
		}
	} catch (error) {
		await owner.close();
		process.removeListener('SIGTERM', quit);
		process.removeListener('SIGINT', quit);
		throw error;
	}
}

if (
	import.meta.main ||
	resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url) ||
	resolve(process.argv[1] ?? '') ===
		fileURLToPath(new URL('../initializePreview.ts', import.meta.url))
) {
	const work = process.versions.bun
		? previewNode(process.argv.slice(2)).then((code) => {
				process.exitCode = code;
			})
		: initializePreview();
	void work.catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}
