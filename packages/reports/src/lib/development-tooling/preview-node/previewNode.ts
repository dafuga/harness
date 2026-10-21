import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PreviewServerService } from '../../../services/accounts-access/preview-server-service/PreviewServerService';
import { PreviewWorkerService } from './preview-worker-service/PreviewWorkerService';
import { previewArguments } from '../../../utils/development-tooling/previewArguments';
import { previewOwnerPort } from '../../../utils/accounts-access/previewOwner';
/** The supervisor owns the stable slot; Vite runs in one replaceable Node worker. */
export async function previewNode(args: string[]): Promise<number> {
	const options = previewArguments(args),
		port = Number(process.env.HARNESS_PREVIEW_OWNER_PORT ?? previewOwnerPort);
	if (!Number.isInteger(port) || port < 1024 || port > 65535)
		throw new Error('Invalid preview ownership port.');
	const owner = new PreviewServerService(port);
	let directory = '',
		worker: PreviewWorkerService | undefined;
	let finish!: (code: number) => void;
	const ended = new Promise<number>((resolve) => (finish = resolve));
	const quit = () => {
		void (async () => {
			await worker?.close();
			await owner.close();
			finish(0);
		})().catch(() => finish(1));
	};
	process.once('SIGTERM', quit);
	process.once('SIGINT', quit);
	try {
		const result = await owner.run(options.identity, async () => {
			const launch = await buildPreviewWorker();
			directory = launch.directory;
			worker = new PreviewWorkerService(launch.entry, args, `http://127.0.0.1:${options.port}`);
			return worker.start();
		});
		console.log(`${result.reused ? 'Reusing Harness preview' : 'Harness preview'}: ${result.url}`);
		if (!result.reused) return await ended;
		return 0;
	} catch (cause) {
		await worker?.close();
		await owner.close();
		throw cause;
	} finally {
		process.removeListener('SIGTERM', quit);
		process.removeListener('SIGINT', quit);
		if (directory) await rm(directory, { recursive: true, force: true });
	}
}
async function buildPreviewWorker() {
	const cache = fileURLToPath(new URL('../../../../.cache/', import.meta.url));
	await mkdir(cache, { recursive: true });
	const directory = await mkdtemp(join(cache, 'preview-node-'));
	const built = await Bun.build({
		entrypoints: [
			fileURLToPath(new URL('../../../initializers/initializePreview.ts', import.meta.url))
		],
		outdir: directory,
		target: 'node',
		packages: 'external',
		naming: 'entry.mjs'
	});
	if (!built.success) {
		await rm(directory, { recursive: true, force: true });
		throw new Error('Could not prepare the managed preview runtime.');
	}
	return { directory, entry: resolve(built.outputs[0].path) };
}
