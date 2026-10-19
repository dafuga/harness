import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
/** Run Vite with the same Node filesystem ordering as SvelteKit's normal sync command. */
export async function previewNode(args: string[]): Promise<number> {
	const cache = fileURLToPath(new URL('../../.cache/', import.meta.url));
	await mkdir(cache, { recursive: true });
	const directory = await mkdtemp(join(cache, 'preview-node-'));
	try {
		const built = await Bun.build({
			entrypoints: [
				fileURLToPath(new URL('../initializers/initializePreview.ts', import.meta.url))
			],
			outdir: directory,
			target: 'node',
			packages: 'external',
			naming: 'entry.mjs'
		});
		if (!built.success) throw new Error('Could not prepare the managed preview runtime.');
		const child = spawn('node', [resolve(built.outputs[0].path), ...args], {
			stdio: 'inherit',
			env: process.env
		});
		const terminate = () => {
			child.kill('SIGTERM');
		};
		const interrupt = () => {
			child.kill('SIGINT');
		};
		process.once('SIGTERM', terminate);
		process.once('SIGINT', interrupt);
		try {
			return await new Promise<number>((finish, reject) => {
				child.once('error', reject);
				child.once('exit', (code) => finish(code ?? 1));
			});
		} finally {
			process.removeListener('SIGTERM', terminate);
			process.removeListener('SIGINT', interrupt);
		}
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}
