import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { rendererAssets } from '../../src/lib/initialize-desktop/rendererAssets';

/** Serve exactly the stamped static build, using the same asset resolver as Electron. */
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
}).listen(Number(process.env.HARNESS_DESKTOP_TEST_PORT ?? '5797'), '127.0.0.1');
