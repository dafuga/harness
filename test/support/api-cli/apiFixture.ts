import type { ApiRequestObservation } from './apiFixture.types';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { runHarness } from '../cli';

export const projectId = '22222222-2222-4222-8222-222222222222';
export const requestId = '8775318f-d765-4e78-9d40-6cb92e1f6b11';
export const commit = 'a'.repeat(40);
export const png = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG0cAAAAASUVORK5CYII=',
	'base64'
);
const sha256 = createHash('sha256').update(png).digest('hex');
const snapshot = {
	project: { id: projectId, name: 'Fixture' },
	revision: { branch: 'feat/api', commit, tip: commit, atTip: true },
	writable: true,
	capabilities: { agents: true, planning: true },
	entities: [{ id: 'page.example', title: 'Example', category: 'pages' }]
};
const contract = { summary: 'A real contract', inputs: [], outputs: [], errors: [] };

function evidence() {
	return {
		scope: { branch: 'feat/api', commit, mode: 'current' },
		identity: {
			sourceCommit: commit,
			sourceTree: 'c'.repeat(40),
			notesRevision: null,
			evidenceRevision: null
		},
		evidence: {
			mode: 'current',
			before: null,
			after: {
				commit,
				record: { id: 'b'.repeat(64) },
				captures: [
					{
						scenario: 'page-screens',
						state: 'ready',
						usable: true,
						current: true,
						capture: {
							evidence: 'screen',
							kind: 'screenshot',
							state: 'ready',
							viewport: 'desktop',
							sha256,
							mediaType: 'image/png',
							status: 'passed',
							capturedAt: '2026-10-24T12:00:00Z'
						}
					}
				]
			}
		}
	};
}

function answer(operation: string, input: Record<string, unknown>, endpoints: boolean) {
	const stable: Record<string, unknown> = {
		connect: { token: 'synthetic-local-secret', snapshot },
		snapshot,
		startRun: { runId: 'run-1' },
		cancelRun: true,
		providers: [{ id: 'codex', models: [{ id: 'explicit-model' }] }]
	};
	if (Object.hasOwn(stable, operation)) return stable[operation];
	if (operation === 'registry')
		return {
			commit,
			units: [
				{ id: 'page.example', kind: 'page', contract },
				{
					id: 'entry.program',
					kind: 'entry',
					contract: { inputs: [], outputs: [{ name: 'buildProgram', type: 'Command' }], errors: [] }
				},
				...(endpoints
					? [
							{
								id: 'endpoint.orders',
								kind: 'endpoint',
								status: 'active',
								title: '/api/orders',
								contract
							}
						]
					: [])
			]
		};
	if (operation === 'entity') return { id: input.entityId, contract };
	if (operation === 'createPlan') return { id: 'function.format-totals', contract: input.contract };
	if (operation === 'events')
		return {
			events: [
				{ sequence: 4, value: { runId: 'run-1', kind: 'finished' } },
				{ sequence: 5, value: { runId: 'another-run', kind: 'status' } }
			]
		};
	if (operation === 'evidence') return evidence();
	return { ok: true };
}

async function observe(request: IncomingMessage): Promise<ApiRequestObservation> {
	const chunks: Buffer[] = [];
	for await (const chunk of request) chunks.push(Buffer.from(chunk));
	const text = Buffer.concat(chunks).toString();
	const body = text ? JSON.parse(text) : {};
	const url = new URL(request.url!, 'http://127.0.0.1');
	const operation = body.method ?? url.pathname.split('/').at(-1)!;
	const input = body.input ?? Object.fromEntries(url.searchParams);
	for (const name of ['notesRevision', 'evidenceRevision', 'viewport'])
		if (operation === 'artifact') input[name] ??= null;
	return {
		url: url.href,
		httpMethod: request.method!,
		operation,
		body,
		input,
		authorization: request.headers.authorization
	};
}

function respond(response: ServerResponse, observed: ApiRequestObservation, corrupted: boolean) {
	const { operation, body, input } = observed;
	const url = new URL(observed.url);
	if (operation === 'entity' && input.entityId === 'entry.program') {
		response
			.writeHead(404, { 'content-type': 'application/json' })
			.end('{"error":"entity-not-found"}');
		return;
	}
	if (url.pathname === '/api/redirect') {
		response.writeHead(302, { location: '/api/redirect-target' }).end();
		return;
	}
	if (url.pathname === '/api/denied') {
		response.writeHead(403, { 'content-type': 'application/json' }).end('{"error":"forbidden"}');
		return;
	}
	if (operation === 'artifact' || url.pathname === '/api/raw-image') {
		response
			.writeHead(200, { 'content-type': 'image/png' })
			.end(corrupted ? Buffer.from('corrupt') : png);
		return;
	}
	let value: unknown = answer(operation, input, endpoints);
	if (url.pathname === '/api/future')
		value = { tags: url.searchParams.getAll('tag'), text: 'x'.repeat(70000) };
	if (url.pathname === '/api/custom') value = { method: observed.httpMethod, body };
	response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(value));
}

export async function apiFixture(mode: 'local' | 'hosted', endpoints = false) {
	const directory = await mkdtemp(join(tmpdir(), 'harness-api-cli-'));
	const sessions = join(directory, 'sessions');
	const seen: ApiRequestObservation[] = [];
	let corrupted = false;
	const server = createServer((request, response) => {
		void observe(request)
			.then((observed) => {
				seen.push(observed);
				respond(response, observed, corrupted, endpoints);
			})
			.catch(() => response.writeHead(500).end());
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address() as { port: number };
	const origin = `http://127.0.0.1:${address.port}`;
	return {
		directory,
		seen,
		origin,
		corrupt: () => {
			corrupted = true;
		},
		sessionFiles: () =>
			existsSync(sessions) ? readdirSync(sessions).map((file) => join(sessions, file)) : [],
		cli: (args: string[], success = true) =>
			runHarness(
				['api', '--url', origin, ...(mode === 'hosted' ? ['--project', projectId] : []), ...args],
				directory,
				success,
				{
					HARNESS_API_HOME: sessions,
					HARNESS_API_TOKEN: mode === 'hosted' ? 'synthetic-hosted-secret' : '',
					HARNESS_API_PROJECT: '',
					HARNESS_API_URL: ''
				}
			),
		close: async () => {
			server.closeAllConnections();
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve()))
			);
			await rm(directory, { recursive: true, force: true });
		}
	};
}
