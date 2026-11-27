import { writeFileSync } from 'node:fs';
import { createServer, type AddressInfo } from 'node:net';
import { join, resolve } from 'node:path';
import { trackerCli } from '../../scripts/needs-you-canary/trackerCli';
import { withTempDir } from './temporary';

/** A loopback port with no listener, as the daemon's port is while it restarts. */
async function closedPort(): Promise<number> {
	const server = createServer();
	await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
	const { port } = server.address() as AddressInfo;
	await new Promise((done) => server.close(done));
	return port;
}

/** The real native CLI, as the installed `tracker` runs it, configured for `directory`. */
function cliProgram(directory: string, port: number): string {
	const config = join(directory, 'tracker.json');
	const fields = {
		version: 1,
		role: 'hub',
		node: 'fixture-mac',
		database: join(directory, 'tracker.db'),
		apiPort: port,
		syncPort: port === 65_535 ? port - 1 : port + 1,
		legacyFenceFile: join(directory, 'fence.json'),
		syncSecretFile: join(directory, 'secret')
	};
	writeFileSync(config, JSON.stringify(fields), { mode: 0o600 });
	const entry = join(directory, 'cli.ts');
	const source = resolve('src/commands/projects-sessions/tracker-command/runNativeTracker.ts');
	writeFileSync(
		entry,
		`import { runNativeTracker } from ${JSON.stringify(source)};
process.exit(await runNativeTracker(process.argv.slice(2), ${JSON.stringify(config)}));\n`
	);
	const program = join(directory, 'tracker');
	writeFileSync(program, `#!/bin/sh\nexec bun ${JSON.stringify(entry)} "$@"\n`, { mode: 0o700 });
	return program;
}

/** What the canary's tracker call throws when the real CLI gets no reply from the daemon. */
export function realOutageError(): Promise<Error> {
	return withTempDir('canary-outage-', async (directory) => {
		const call = trackerCli(cliProgram(directory, await closedPort()));
		return call(['show', 'abc123']).then(
			() => {
				throw new Error('the CLI reached a tracker on a closed port');
			},
			(error: Error) => error
		);
	});
}
