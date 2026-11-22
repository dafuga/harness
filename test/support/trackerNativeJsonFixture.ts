import { writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';

/** A loopback stand-in for the native Tracker API that answers every request with a large JSON list. */
export async function startTrackerNativeJsonFixture(home: string, count = 2_000) {
	const items = Array.from({ length: count }, (_, index) => ({
		id: `fixture${String(index).padStart(4, '0')}`,
		title: `Fixture item ${index} with enough text to fill the pipe buffer quickly`,
		status: 'open',
		needs_daniel: true
	}));
	const body = JSON.stringify(items);
	const server = createServer((_request, response) => {
		response.writeHead(200, { 'content-type': 'application/json' });
		response.end(body);
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const { port } = server.address() as AddressInfo;
	const config = join(home, 'tracker.json');
	const node = { version: 1, node: 'fixture-hub', role: 'hub', apiPort: port };
	await writeFile(
		config,
		JSON.stringify({
			...node,
			syncPort: port === 65_535 ? port - 1 : port + 1,
			database: join(home, 'tracker.sqlite'),
			legacyFenceFile: join(home, 'tracker-fence.json'),
			syncSecretFile: join(home, 'sync.secret')
		}),
		{ mode: 0o600 }
	);
	const close = () => new Promise<void>((resolve) => server.close(() => resolve()));
	return { config, count, close };
}
