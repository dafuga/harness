import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID, createHash } from 'node:crypto';
import { realpath, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AnalyticsRepository } from '../repositories/AnalyticsRepository';
import type { AnalyticsContext, AnalyticsEvent } from '../core/analyticsTypes';
import { loopPaths, readLoop } from '../workflows/loopState';

const git = promisify(execFile);
export async function projectIdentity(root: string): Promise<string> {
	const directory = await realpath(root).catch(() => resolve(root));
	try {
		const { stdout } = await git('git', ['worktree', 'list', '--porcelain'], { cwd: directory });
		const primary = stdout.split('\n').find((line) => line.startsWith('worktree '));
		return primary ? primary.slice(9) : directory;
	} catch {
		return directory;
	}
}

export async function resolvedContext(
	context: AnalyticsContext,
	root: string
): Promise<AnalyticsContext> {
	context = contextDefaults(context);
	if (context.task && (context.loop || context.step))
		throw new Error('Use either --task or --loop/--step.');
	if (context.step && !context.loop) throw new Error('--step requires --loop.');
	const model = authorModel(context);
	if (!context.loop) return { ...context, agentModel: model };
	const state = await readLoop(loopPaths(root, context.loop).state);
	if (context.step && !state.steps.some((step) => step.id === context.step))
		throw new Error('Loop step does not exist.');
	return { ...context, agentModel: model ?? state.agentModel, loopRun: state.createdAt };
}
export async function recordAnalytics(
	event: Omit<AnalyticsEvent, 'id' | 'timestamp' | 'project'>,
	root = process.cwd()
): Promise<void> {
	if (process.env.HARNESS_ANALYTICS_DISABLED === '1') return;
	try {
		const repository = new AnalyticsRepository();
		try {
			repository.record({
				...event,
				id: randomUUID(),
				timestamp: new Date().toISOString(),
				project: await projectIdentity(root)
			});
		} finally {
			repository.close();
		}
	} catch {
		console.error('Warning: Harness analytics could not be recorded.');
	}
}
export function fingerprint(value: unknown): string {
	return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export async function validateReport(context: AnalyticsContext): Promise<void> {
	if (!context.report) return;
	if (!/^[a-zA-Z0-9-]+$/.test(context.report)) throw new Error('Invalid report ID.');
	const home = process.env.PROJECT_REPORTS_HOME ?? `${process.env.HOME}/.codex/project-reports`;
	await readFile(resolve(home, 'runs', context.report, 'manifest.json'));
}

function contextDefaults(context: AnalyticsContext): AnalyticsContext {
	return {
		loop: context.loop ?? process.env.HARNESS_ANALYTICS_LOOP,
		step: context.step ?? process.env.HARNESS_ANALYTICS_STEP,
		task: context.task ?? process.env.HARNESS_ANALYTICS_TASK,
		agentModel: context.agentModel,
		report: context.report ?? process.env.HARNESS_ANALYTICS_REPORT
	};
}

function authorModel(context: AnalyticsContext): string | undefined {
	return context.agentModel ?? process.env.HARNESS_AGENT_MODEL;
}
