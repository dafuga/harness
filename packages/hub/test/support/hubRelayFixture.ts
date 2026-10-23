import type { Call } from './hubRelayFixture.types';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { relayBinding, startRelay } from '../../../relay/test/support/relayFixture';

const entry = fileURLToPath(new URL('./hubRemoteWorker.ts', import.meta.url));
/** What the hub under test is configured to tell a registering host. */
export const RELAY_ORIGIN = 'https://relay.fixture.example';
const origin = { type: 'text' as const, value: RELAY_ORIGIN };
/** A namespace whose objects fail, with words that must never reach a caller of the hub. */
const brokenScript = `import { DurableObject } from 'cloudflare:workers';
export class Broken extends DurableObject {
	async fetch() {
		return new Response('upstream detail: synthetic-secret', { status: 500 });
	}
}
export default { fetch() { return new Response('broken'); } };`;
const brokenBinding = { type: 'durable-object' as const, worker: 'broken', exportName: 'Broken' };

async function bundle(): Promise<string> {
	const result = await build({
		entryPoints: [entry],
		bundle: true,
		format: 'esm',
		target: 'es2022',
		platform: 'neutral',
		write: false,
		logLevel: 'silent'
	});
	return result.outputFiles[0].text;
}
/** A request to `/api/remote…` of one hub Worker, with a test session or with none. */
function caller(worker: { fetch(url: string, init?: RequestInit): Promise<Response> }): Call {
	return (session, method, path, body) => {
		const headers: Record<string, string> = {};
		if (session) headers['x-test-session'] = session;
		if (body !== undefined) headers['Content-Type'] = 'application/json';
		const init = { method, headers, body: body === undefined ? undefined : JSON.stringify(body) };
		const url = `https://hub.fixture.example/api/remote${path}`;
		/* The test's own connection to workerd is sometimes reset; that is not an answer. */
		return worker.fetch(url, init).catch(() => worker.fetch(url, init));
	};
}

/**
 * The hub's remote API and the relay, both in workerd: the hub reaches the host objects through
 * a namespace binding and through nothing else. Nothing leaves the machine.
 */
export async function startHubRelay() {
	const script = await bundle();
	const relay = await startRelay({
		workers: [
			{
				name: 'hub-app',
				script,
				env: { REMOTE_HOSTS: relayBinding, HARNESS_RELAY_ORIGIN: origin }
			},
			{ name: 'hub-unbound', script, env: { HARNESS_RELAY_ORIGIN: origin } },
			{ name: 'broken', script: brokenScript, objects: ['Broken'] },
			{
				name: 'hub-broken',
				script,
				env: { REMOTE_HOSTS: brokenBinding, HARNESS_RELAY_ORIGIN: origin }
			}
		]
	});
	return {
		relay,
		hub: caller(await relay.worker('hub-app')),
		unbound: caller(await relay.worker('hub-unbound')),
		broken: caller(await relay.worker('hub-broken')),
		stop: () => relay.stop()
	};
}

export type { HubRelayFixture } from './hubRelayFixture.types';
