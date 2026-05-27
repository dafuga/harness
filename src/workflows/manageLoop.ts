import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fail } from '../core/errors';
import { validateKebabName } from '../core/validation';

export interface LoopStep {
	id: string;
	title: string;
	status: 'pending' | 'complete';
	completedAt?: string;
	evidence?: string;
}

export interface LoopState {
	name: string;
	goal: string;
	createdAt: string;
	updatedAt: string;
	steps: LoopStep[];
}

export interface LoopStatus {
	state: LoopState;
	tracePath: string;
}

interface LoopInput {
	root?: string;
	now?: () => string;
}

export interface CreateLoopInput extends LoopInput {
	name: string;
	goal: string;
}

export interface AddLoopStepInput extends LoopInput {
	loop: string;
	step: string;
	title: string;
}

export interface CompleteLoopStepInput extends LoopInput {
	loop: string;
	step: string;
	evidence: string;
}

export interface ReadLoopInput extends LoopInput {
	loop: string;
}

export async function createLoop(input: CreateLoopInput): Promise<LoopStatus> {
	const name = validateLoopId(input.name, 'Loop name');
	const goal = validateRequiredText(input.goal, 'Loop goal');
	const paths = loopPaths(input.root ?? process.cwd(), name);
	const createdAt = timestamp(input.now);
	const state = { name, goal, createdAt, updatedAt: createdAt, steps: [] };

	await failIfLoopExists(paths.state);
	await mkdir(paths.dir, { recursive: true });
	await writeLoop(paths.state, state);
	await appendTrace(paths.trace, { event: 'loop.created', timestamp: createdAt, name, goal });

	return { state, tracePath: paths.traceRelative };
}

export async function addLoopStep(input: AddLoopStepInput): Promise<LoopStatus> {
	const loop = validateLoopId(input.loop, 'Loop name');
	const step = validateLoopId(input.step, 'Step id');
	const title = validateRequiredText(input.title, 'Step title');
	const paths = loopPaths(input.root ?? process.cwd(), loop);
	const state = await readLoop(paths.state);

	if (state.steps.some((item) => item.id === step)) {
		fail(`Loop step "${step}" already exists.`);
	}

	const updatedAt = timestamp(input.now);
	state.steps.push({ id: step, title, status: 'pending' });
	state.updatedAt = updatedAt;

	await writeLoop(paths.state, state);
	await appendTrace(paths.trace, { event: 'step.added', timestamp: updatedAt, loop, step, title });

	return { state, tracePath: paths.traceRelative };
}

export async function completeLoopStep(input: CompleteLoopStepInput): Promise<LoopStatus> {
	const loop = validateLoopId(input.loop, 'Loop name');
	const step = validateLoopId(input.step, 'Step id');
	const evidence = validateRequiredText(input.evidence, 'Step evidence');
	const paths = loopPaths(input.root ?? process.cwd(), loop);
	const state = await readLoop(paths.state);
	const item = state.steps.find((candidate) => candidate.id === step);

	if (!item) {
		fail(`Loop step "${step}" does not exist.`);
	}

	if (item.status === 'complete') {
		fail(`Loop step "${step}" is already complete.`);
	}

	const completedAt = timestamp(input.now);
	Object.assign(item, { status: 'complete' as const, completedAt, evidence });
	state.updatedAt = completedAt;

	await writeLoop(paths.state, state);
	await appendTrace(paths.trace, {
		event: 'step.completed',
		timestamp: completedAt,
		loop,
		step,
		evidence
	});

	return { state, tracePath: paths.traceRelative };
}

export async function readLoopStatus(input: ReadLoopInput): Promise<LoopStatus> {
	const loop = validateLoopId(input.loop, 'Loop name');
	const paths = loopPaths(input.root ?? process.cwd(), loop);
	const state = await readLoop(paths.state);

	return { state, tracePath: paths.traceRelative };
}

export function renderLoopStatus(status: LoopStatus): string {
	const lines = [
		`Loop: ${status.state.name}`,
		`Goal: ${status.state.goal}`,
		`Trace: ${status.tracePath}`,
		'',
		'Steps:'
	];

	if (status.state.steps.length === 0) {
		return [...lines, '  none'].join('\n');
	}

	return [...lines, ...status.state.steps.flatMap(renderStep)].join('\n');
}

function renderStep(step: LoopStep): string[] {
	const lines = [`  [${step.status}] ${step.id} - ${step.title}`];
	if (step.evidence) lines.push(`    evidence: ${step.evidence}`);
	return lines;
}

function loopPaths(
	root: string,
	loop: string
): { dir: string; state: string; trace: string; traceRelative: string } {
	const dirRelative = join('specification', 'loops', loop);
	return {
		dir: join(root, dirRelative),
		state: join(root, dirRelative, 'loop.json'),
		trace: join(root, dirRelative, 'trace.ndjson'),
		traceRelative: join(dirRelative, 'trace.ndjson')
	};
}

async function failIfLoopExists(path: string): Promise<void> {
	try {
		await readFile(path, 'utf8');
		fail('Loop already exists.');
	} catch (error) {
		if (isMissingFile(error)) return;
		throw error;
	}
}

async function readLoop(path: string): Promise<LoopState> {
	try {
		return JSON.parse(await readFile(path, 'utf8')) as LoopState;
	} catch (error) {
		if (isMissingFile(error)) fail('Loop does not exist.');
		throw error;
	}
}

async function writeLoop(path: string, state: LoopState): Promise<void> {
	await writeFile(path, `${JSON.stringify(state, null, '\t')}\n`);
}

async function appendTrace(path: string, event: Record<string, unknown>): Promise<void> {
	await appendFile(path, `${JSON.stringify(event)}\n`);
}

function validateLoopId(value: string, label: string): string {
	return validateKebabName(value, label);
}

function validateRequiredText(value: string, label: string): string {
	const text = value.trim();
	if (!text) fail(`${label} cannot be empty.`);
	return text;
}

function timestamp(now: (() => string) | undefined): string {
	return now ? now() : new Date().toISOString();
}

function isMissingFile(error: unknown): boolean {
	return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
