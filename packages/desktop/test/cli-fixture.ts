import { script } from './cli-provider-fixture';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { afterEach, vi } from 'vitest';
import { ResourceQueueService } from '../../../src/services/execution-runtimes/ResourceQueueService';
import { snapshot } from '../../../test/support/resourceFixture';
import { ClaudeCliAdapter } from '../src/adapters/claude-cli-adapter/ClaudeCliAdapter';
import { CodexAppServerAdapter } from '../src/adapters/codex-app-server-adapter/CodexAppServerAdapter';
import type { AgentTurn } from '../src/models/AgentRunner.types';
export const resourceTelemetry = { pressure: false };
const queues: ResourceQueueService[] = [];
const roots: string[] = [],
	pids: number[] = [];
export { pids };
export const png =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=';

interface Event {
	kind: string;
	pid?: number;
	argv?: string[];
	cwd?: string;
	env?: string[];
	resources?: { lease?: string; cpus?: string; threads?: string };
	method?: string;
	params?: Record<string, unknown>;
	input?: string;
}
afterEach(async () => {
	queues.splice(0).forEach((queue) => queue.close());
	resourceTelemetry.pressure = false;
	vi.unstubAllEnvs();
	for (const pid of pids.splice(0)) {
		try {
			process.kill(pid, 'SIGKILL');
		} catch {
			/* Fixture already stopped. */
		}
	}
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
export async function fixture(mode: string) {
	for (const key of 'OPENAI_API_KEY OPENAI_BASE_URL ANTHROPIC_API_KEY ANTHROPIC_BASE_URL'.split(
		' '
	))
		vi.stubEnv(key, 'fixture-sentinel');
	const root = await realpath(await mkdtemp(join(tmpdir(), 'harness-cli-')));
	roots.push(root);
	vi.stubEnv('HARNESS_RESOURCES_HOME', join(root, 'resources'));
	vi.stubEnv('HARNESS_RESOURCE_LEASE', '');
	const path = join(root, 'fake.mjs');
	const config = `const mode=${JSON.stringify(mode)},png=${JSON.stringify(png)};`;
	await writeFile(path, config + '\n' + script);
	const command = { command: process.execPath, args: [path] };
	const queue = new ResourceQueueService({
		home: join(root, 'resources'),
		env: {},
		monitor: {
			sample: async () =>
				snapshot({ memoryPressure: resourceTelemetry.pressure ? 'critical' : 'normal' })
		}
	});
	queues.push(queue);
	const adapter = mode.startsWith('codex')
		? new CodexAppServerAdapter(command, queue)
		: new ClaudeCliAdapter(command, queue);
	const events = async (): Promise<Event[]> => {
		try {
			return (await readFile(join(root, 'events.ndjson'), 'utf8'))
				.trim()
				.split('\n')
				.map((line) => JSON.parse(line));
		} catch {
			return [];
		}
	};
	return { root, command, adapter, events, queue };
}
export function turn(cwd: string, signal = new AbortController().signal): AgentTurn {
	return {
		cwd,
		signal,
		model: 'selected',
		effort: 'high',
		prompt: 'Requested task',
		access: 'read-only',
		onText: vi.fn(),
		onStatus: vi.fn()
	};
}
export function alive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}
