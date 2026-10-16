/**
 * TEST ONLY. Runs the disposable remote fixture until it is told to stop.
 *
 *   cd packages/desktop && bun run remote:fixture
 *
 * Ports: HARNESS_FIXTURE_RELAY_PORT (8791) and HARNESS_FIXTURE_CONTROL_PORT (8792), both on
 * 127.0.0.1. Control, from this machine only: GET /status, POST /pairing (a new one-time offer;
 * its code is printed here and returned to the caller), /suspend, /resume, /lock, /unlock,
 * /revoke ({"deviceId": …} or every phone). End the process to stop. Public facts are written to
 * work/mobile/remote-fixture/. No reusable credential and no key is printed or written there.
 */
import { fileURLToPath } from 'node:url';
import { startRemoteFixture } from './remote-fixture-host';

const port = (name: string, fallback: number) => Number(process.env[name] ?? fallback);
const log = (line: string) => console.log(`[remote-fixture] ${line}`);

async function main(): Promise<void> {
	const fixture = await startRemoteFixture({
		relayPort: port('HARNESS_FIXTURE_RELAY_PORT', 8791),
		controlPort: port('HARNESS_FIXTURE_CONTROL_PORT', 8792),
		publicDirectory: fileURLToPath(new URL('../../../work/mobile/remote-fixture', import.meta.url)),
		log
	});
	let stopping = false;
	const stop = async () => {
		if (stopping) return;
		stopping = true;
		log('Stopping: the relay, the host and the synthetic project are removed.');
		await fixture.stop();
		process.exit(0);
	};
	process.on('SIGINT', () => void stop());
	process.on('SIGTERM', () => void stop());
	log(`Relay ${fixture.relayOrigin}, control ${fixture.controlOrigin}, host ${fixture.hostId}.`);
	log(`Project "${fixture.project.name}" (${fixture.project.id}).`);
	const first = await fetch(fixture.controlOrigin + '/pairing', { method: 'POST' });
	if (!first.ok) log('No first pairing offer could be opened; POST /pairing to try again.');
	log('Running until this process is ended (SIGTERM or Ctrl-C).');
}
void main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : 'The remote fixture failed to start.');
	process.exit(1);
});
