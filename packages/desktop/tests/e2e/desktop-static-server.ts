import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { rendererAssets } from '../../src/lib/initialize-desktop/rendererAssets';

/** Serve exactly the stamped static build, using the same asset resolver as Electron. */
const named = process.env.HARNESS_DESKTOP_TEST_PORT ?? '5797';
const port = /^\d+$/.test(named) ? Number(named) : NaN;
if (!(port >= 1024 && port <= 65535)) {
	throw new Error(`HARNESS_DESKTOP_TEST_PORT must be a port from 1024 to 65535, not "${named}".`);
}
const root = resolve(import.meta.dirname, '../../build');
createServer(async (request, response) => {
	try {
		const asset = await rendererAssets(root, `harness://app${request.url ?? '/'}`);
		response.writeHead(asset.status, Object.fromEntries(asset.headers));
		response.end(Buffer.from(await asset.arrayBuffer()));
	} catch {
		response.writeHead(500);
		response.end('Compiled renderer unavailable');
	}
}).listen(port, '127.0.0.1');
