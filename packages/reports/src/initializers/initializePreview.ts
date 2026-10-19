import { createServer } from 'vite';
import { previewArguments } from '../utils/previewArguments';

/** The original independent Vite startup, under the shared regression command. */
export async function initializePreview(args = process.argv.slice(2)): Promise<void> {
	const options = previewArguments(args);
	const server = await createServer({
		root: options.root,
		configFile: options.configFile,
		server: { host: '127.0.0.1', port: options.port }
	});
	await server.listen();
	server.printUrls();
}
if (import.meta.main) {
	void initializePreview().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}
