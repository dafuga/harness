// @harness-uid u_2h4nm5fwn7
import type { LoopState, LoopInput, LoopPaths } from './loopState.types';
export type {
	LoopStep,
	LoopEvaluator,
	LoopState,
	LoopStatus,
	LoopInput,
	LoopPaths
} from './loopState.types';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { fail } from '../../../core/development-tooling/errors';
import { validateKebabName } from './validation';

const loopStateSchema = z
	.object({
		name: z.string().min(1),
		goal: z.string().min(1),
		createdAt: z.string(),
		updatedAt: z.string(),
		agentModel: z.string().optional(),
		template: z.string().optional(),
		templateLineage: z.array(z.string()).optional(),
		enforceOrder: z.boolean().optional(),
		regressionCommits: z.literal(1).optional(),
		completion: z
			.object({
				version: z.literal(1),
				kind: z.enum(['coding', 'planning']),
				plan: z.string().optional()
			})
			.optional(),
		closed: z
			.object({
				status: z.literal('abandoned'),
				reason: z.string().min(1),
				closedAt: z.string().min(1)
			})
			.optional(),
		steps: z.array(
			z
				.object({
					id: z.string().min(1),
					title: z.string(),
					status: z.enum(['pending', 'complete']),
					completedAt: z.string().optional(),
					evidence: z.string().optional()
				})
				.passthrough()
		),
		evaluators: z
			.array(
				z
					.object({
						id: z.string().min(1),
						title: z.string(),
						command: z.string().min(1),
						step: z.string().optional()
					})
					.passthrough()
			)
			.optional()
	})
	.passthrough();

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
		const parsed = loopStateSchema.safeParse(JSON.parse(await readFile(path, 'utf8')));
		if (!parsed.success) return fail('Invalid loop state: persisted schema mismatch.');
		return parsed.data;
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
