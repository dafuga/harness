import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordCases, outcome } from './desktop.service.project-task.fixture';
import { ProjectTaskService } from '../../src/services/agents-providers/desktop-run-service/project-task-service/ProjectTaskService';
import type { ProjectTaskContext } from '../../src/utils/agents-providers/prepareProjectTask';
import { promoteChange } from '../../src/utils/projects-sessions/promoteChange';
import type { Agent, AgentInput } from './desktop.service.project-task.test.types';

vi.mock('../../src/utils/projects-sessions/promoteChange', () => ({
	promoteChange: vi.fn(async () => 'Promoted to stage.')
}));

const UNIT = 'desktop.service.project-task';
const COMMIT = 'a'.repeat(40);
const OWNED = 'src/owned.ts';
const CHANGED = 'Changes recorded. Verification is still required.';
const REFUSED = 'The read-only agent changed files. Changes were preserved for review.';
const CANCELLED = 'The run was cancelled.';

let root: string;
let controller: AbortController;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), 'project-task-'));
	execFileSync('git', ['init', '-q', root]);
	controller = new AbortController();
});

afterEach(async () => {
	vi.clearAllMocks();
	await rm(root, { recursive: true, force: true });
});

async function writeOwned(): Promise<void> {
	await mkdir(join(root, 'src'), { recursive: true });
	await writeFile(join(root, OWNED), 'export const value = 2;\n');
}

function contextFor(options: { mode: 'ask' | 'change'; environment?: 'stage'; agent: Agent }) {
	const emit = vi.fn();
	const session = { atBranch: vi.fn(async () => undefined) };
	const runner = { run: vi.fn(async (input: AgentInput) => options.agent(input)) };
	const units = [{ id: UNIT, owns: { source: [OWNED] } }];
	const request = {
		intent: 'task',
		mode: options.mode,
		branch: 'main',
		commit: COMMIT,
		text: 'Question text',
		environment: options.environment,
		conversation: []
	};
	const context = {
		id: 'run-1',
		root,
		signal: controller.signal,
		emit,
		request,
		revision: { branch: 'main', commit: COMMIT },
		session,
		runner,
		project: { source: { units: vi.fn(async () => units) } }
	} as unknown as ProjectTaskContext;
	return { context, emit, session, runner };
}

function eventsOf(emit: ReturnType<typeof vi.fn>, kind: string): Array<Record<string, unknown>> {
	return emit.mock.calls
		.map(([event]) => event as Record<string, unknown>)
		.filter((event) => event.kind === kind);
}

test('Answers an ask request without writes and resolves Answer complete', async () => {
	const { context, emit, session, runner } = contextFor({
		mode: 'ask',
		agent: async () => ({ text: 'The unit is registered.' })
	});
	const result = await outcome(new ProjectTaskService().run(context));
	expect(result).toEqual({ output: { summary: 'Answer complete.' } });
	expect(runner.run).toHaveBeenCalledWith(
		expect.objectContaining({ access: 'read-only', cwd: root })
	);
	expect(session.atBranch).toHaveBeenCalledTimes(2);
	expect(eventsOf(emit, 'text')).toEqual([
		{ runId: 'run-1', kind: 'text', text: 'The unit is registered.' }
	]);
	recordCases('answers-ask-without-writes', [
		{ name: 'ask request resolves Answer complete', input: { mode: 'ask' }, ...result }
	]);
});

test('Records a change request without an environment as verification still required', async () => {
	const { context, emit } = contextFor({
		mode: 'change',
		agent: async ({ access }) => {
			expect(access).toBe('write');
			await writeOwned();
			return { text: '' };
		}
	});
	const result = await outcome(new ProjectTaskService().run(context));
	expect(result).toEqual({ output: { summary: CHANGED } });
	const [changes] = eventsOf(emit, 'changes');
	expect((changes.files as Array<{ path: string }>).map((file) => file.path)).toEqual([OWNED]);
	const [status] = eventsOf(emit, 'status');
	expect(String(status.detail)).toContain(UNIT);
	recordCases('records-change-without-environment', [
		{ name: 'change writes an owned file', input: { mode: 'change' }, ...result }
	]);
});

test('Rejects an ask request whose read-only agent changed a file', async () => {
	const { context } = contextFor({
		mode: 'ask',
		agent: async () => {
			await writeOwned();
			return { text: '' };
		}
	});
	const result = await outcome(new ProjectTaskService().run(context));
	expect(result).toEqual({ error: REFUSED });
	expect(await readFile(join(root, OWNED), 'utf8')).toContain('value = 2');
	recordCases('refuses-ask-file-change', [
		{ name: 'ask agent writes a project file', input: { mode: 'ask' }, ...result }
	]);
});

test('Rejects an ask request that observed a host file operation outside the project', async () => {
	const { context, emit } = contextFor({
		mode: 'ask',
		agent: async ({ onFile }) => {
			onFile(join(root, '..', 'outside-host-operation.txt'));
			return { text: '' };
		}
	});
	const result = await outcome(new ProjectTaskService().run(context));
	expect(result).toEqual({ error: REFUSED });
	expect(eventsOf(emit, 'changes')).toEqual([
		expect.objectContaining({ kind: 'changes', files: [] })
	]);
	recordCases('refuses-ask-host-operation', [
		{ name: 'ask agent touches a path outside the root', input: { mode: 'ask' }, ...result }
	]);
});

test('Reports cancellation when the run is aborted before the agent resolves', async () => {
	const { context, session } = contextFor({
		mode: 'ask',
		agent: async () => {
			controller.abort();
			return { text: '' };
		}
	});
	const result = await outcome(new ProjectTaskService().run(context));
	expect(result).toEqual({ error: CANCELLED });
	expect(session.atBranch).toHaveBeenCalledTimes(1);
	recordCases('reports-cancellation-after-abort', [
		{ name: 'abort during an ask run', input: { mode: 'ask' }, ...result }
	]);
});

test('Lets the read-only change error replace cancellation', async () => {
	const { context } = contextFor({
		mode: 'ask',
		agent: async () => {
			controller.abort();
			await writeOwned();
			return { text: '' };
		}
	});
	const result = await outcome(new ProjectTaskService().run(context));
	expect(result).toEqual({ error: REFUSED });
	recordCases('recording-error-replaces-cancellation', [
		{ name: 'abort after an ask run wrote a file', input: { mode: 'ask' }, ...result }
	]);
});

test('Propagates an agent failure after the recording step', async () => {
	const { context, emit } = contextFor({
		mode: 'change',
		agent: async () => {
			throw new Error('model unavailable');
		}
	});
	const result = await outcome(new ProjectTaskService().run(context));
	expect(result).toEqual({ error: 'model unavailable' });
	expect(eventsOf(emit, 'changes')).toHaveLength(1);
	recordCases('propagates-agent-failure', [
		{ name: 'agent rejects before writing', input: { mode: 'change' }, ...result }
	]);
});

test('Returns the promotion summary for a change request with an environment', async () => {
	const { context } = contextFor({
		mode: 'change',
		environment: 'stage',
		agent: async () => {
			await writeOwned();
			return { text: '' };
		}
	});
	const result = await outcome(new ProjectTaskService().run(context));
	expect(result).toEqual({ output: { summary: 'Promoted to stage.' } });
	expect(promoteChange).toHaveBeenCalledWith(
		expect.objectContaining({ request: expect.objectContaining({ environment: 'stage' }) }),
		expect.any(Map)
	);
	recordCases('promotes-environment-change', [
		{ name: 'change with stage environment', input: { environment: 'stage' }, ...result }
	]);
});
