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

export interface LoopEvaluator {
	id: string;
	title: string;
	command: string;
	step?: string;
}

export interface LoopState {
	name: string;
	goal: string;
	createdAt: string;
	updatedAt: string;
	template?: string;
	templateLineage?: string[];
	steps: LoopStep[];
	evaluators?: LoopEvaluator[];
}

export interface LoopStatus {
	state: LoopState;
	tracePath: string;
}

export interface LoopInput {
	root?: string;
	now?: () => string;
}

export interface LoopPaths {
	dir: string;
	state: string;
	trace: string;
	traceRelative: string;
}

export function loopRoot(input?: LoopInput): string {
	return input?.root ?? process.cwd();
}

export function loopPaths(root: string, loop: string): LoopPaths {
	const dirRelative = join('specification', 'loops', loop);
	return {
		dir: join(root, dirRelative),
		state: join(root, dirRelative, 'loop.json'),
		trace: join(root, dirRelative, 'trace.ndjson'),
		traceRelative: join(dirRelative, 'trace.ndjson')
	};
}

export async function writeNewLoop(paths: LoopPaths, state: LoopState): Promise<void> {
	await failIfLoopExists(paths.state);
	await mkdir(paths.dir, { recursive: true });
	await writeLoop(paths.state, state);
}

export async function readLoop(path: string): Promise<LoopState> {
	try {
		return JSON.parse(await readFile(path, 'utf8')) as LoopState;
	} catch (error) {
		if (isMissingFile(error)) fail('Loop does not exist.');
		throw error;
	}
}

export async function writeLoop(path: string, state: LoopState): Promise<void> {
	await writeFile(path, `${JSON.stringify(state, null, '\t')}\n`);
}

export async function appendTrace(path: string, event: Record<string, unknown>): Promise<void> {
	await appendFile(path, `${JSON.stringify(event)}\n`);
}

export function validateLoopId(value: string, label: string): string {
	return validateKebabName(value, label);
}

export function validateRequiredText(value: string, label: string): string {
	const text = value.trim();
	if (!text) fail(`${label} cannot be empty.`);
	return text;
}

export function timestamp(now: (() => string) | undefined): string {
	return now ? now() : new Date().toISOString();
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

export function isMissingFile(error: unknown): boolean {
	return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
