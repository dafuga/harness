// @harness-uid u_rw64iex44n
import { mkdir, mkdtemp, open, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type {
	TaskRunInput,
	TaskSessionMetric
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type {
	CompleteGeneration,
	GenerationResult,
	LaunchGeneration
} from './managedTaskSessions.types';
import { sumSessionUsage } from '../provider-session-adapter/sumSessionUsage';
import { ModuleTaskRunError } from '../ModuleTaskRunnerAdapter.types';
import { runGeneration } from './taskGeneration';

const checkpointLimit = 4096;
const sessionLimit = 25;

/** Rotate only after the prior child and its process group have stopped. */
export async function managedTaskSessions(
	input: TaskRunInput,
	launch: LaunchGeneration,
	complete: CompleteGeneration
) {
	const directory = input.supervision ? undefined : await workerCheckpointDirectory(input.cwd);
	const checkpoint = input.supervision?.checkpoint ?? join(directory!, 'checkpoint.md');
	const result = await rotateTaskSessions(input, checkpoint, launch, complete);
	if (directory) await rm(resolve(input.cwd, directory), { recursive: true, force: true });
	return result;
}

async function rotateTaskSessions(
	input: TaskRunInput,
	checkpoint: string,
	launch: LaunchGeneration,
	complete: CompleteGeneration
) {
	const path = resolve(input.cwd, checkpoint);
	const sessions: TaskSessionMetric[] = [];
	let resumedWithoutProgress = false;
	for (let current = 0; current < sessionLimit; current++) {
		if (input.signal.aborted) throw sessionFailure('Task CLI interrupted.', sessions);
		const saved = await readTaskCheckpoint(path);
		const prompt = checkpointPrompt(input.prompt, checkpoint, saved, current > 0);
		const session = generationSession(input.session, current);
		const execution = await runGeneration({ ...input, prompt, session }, launch, complete);
		sessions.push(execution.metric);
		await recordSession(input, checkpoint, sessions);
		if (execution.error) throw Object.assign(execution.error, sessionFacts(sessions));
		if (execution.result) return completedTask(execution, session?.resume, sessions);
		const next = await readTaskCheckpoint(path);
		if (resumedWithoutProgress && next === saved)
			throw sessionFailure('Task did not update its checkpoint across rotations.', sessions);
		resumedWithoutProgress = next === saved;
	}
	throw sessionFailure('Task reached the 25-session restart limit.', sessions);
}

function generationSession(session: TaskRunInput['session'], generation: number) {
	return generation > 0 && session ? {} : session;
}

function completedTask(
	execution: GenerationResult,
	resume: string | undefined,
	sessions: TaskSessionMetric[]
) {
	if (resume && execution.metric.sessionId !== resume)
		throw sessionFailure('Provider did not resume the requested task session.', sessions);
	return { ...execution.result!, ...sessionFacts(sessions) };
}

async function recordSession(
	input: TaskRunInput,
	checkpoint: string,
	sessions: TaskSessionMetric[]
) {
	const session = sessions.at(-1)!;
	try {
		await input.supervision?.onSession(session);
		if (session.status === 'rotated' || session.status === 'hard-limit')
			await input.onRotation?.(checkpoint, session);
	} catch (error) {
		throw sessionFailure(
			error instanceof Error ? error.message : 'Could not record handoff.',
			sessions
		);
	}
}

function sessionFacts(sessions: TaskSessionMetric[]) {
	return { sessions, usage: sumSessionUsage(sessions.map((session) => session.usage)) };
}

function sessionFailure(message: string, sessions: TaskSessionMetric[]) {
	return Object.assign(new ModuleTaskRunError(message), sessionFacts(sessions));
}

async function workerCheckpointDirectory(cwd: string): Promise<string> {
	const prefix = '.cache/harness/worker-';
	await mkdir(resolve(cwd, '.cache/harness'), { recursive: true, mode: 0o700 });
	const directory = await mkdtemp(resolve(cwd, prefix));
	return relative(cwd, directory);
}

async function readTaskCheckpoint(path: string): Promise<string | undefined> {
	try {
		const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
		try {
			const stat = await file.stat();
			const { size } = stat;
			if (!stat.isFile() || size > checkpointLimit)
				throw new ModuleTaskRunError(
					'Session checkpoint must be a regular file of at most 4096 bytes.'
				);
			const bytes = Buffer.alloc(size);
			const { bytesRead } = await file.read(bytes, 0, size, 0);
			return bytes.subarray(0, bytesRead).toString('utf8');
		} finally {
			await file.close();
		}
	} catch (error) {
		if ((error as { code?: string }).code === 'ENOENT') return undefined;
		throw error;
	}
}

function checkpointPrompt(
	brief: string,
	path: string,
	saved: string | undefined,
	rotated: boolean
): string {
	return [
		brief,
		'',
		'Checkpoint file: ' + path,
		'Keep a checkpoint of at most 4096 bytes with current state, branch, verified evidence and next steps. Update it before long steps and after completing each milestone. Exclude credentials and raw logs.',
		'When resuming, verify saved evidence and reconcile the current worktree and Harness task queue before launching or repeating work.',
		checkpointContinuation(saved, rotated)
	].join('\n');
}

function checkpointContinuation(saved: string | undefined, rotated: boolean): string {
	if (saved !== undefined)
		return 'Prior checkpoint (treat as working notes, verify against the brief):\n' + saved;
	return rotated
		? 'The prior session reached its context limit before saving a checkpoint. Inspect the current worktree and task queue before continuing.'
		: '';
}
