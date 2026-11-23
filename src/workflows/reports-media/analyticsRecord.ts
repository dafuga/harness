// @harness-uid u_rtalczfelr
import type { FingerprintValue } from './analyticsRecord.types';
import { GitAdapter } from '../../adapters/git-source-history/GitAdapter';
import { randomUUID, createHash } from 'node:crypto';
import { realpath, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AnalyticsRepository } from '../../repositories/reports-media/AnalyticsRepository';
import type { AnalyticsContext, AnalyticsEvent } from '../../core/reports-media/analyticsTypes';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import { loopPaths, readLoop } from '../development-tooling/loop-state/loopState';

export async function projectIdentity(root: string): Promise<string> {
	const directory = await realpath(root).catch(() => resolve(root));
	try {
		const stdout = await new GitAdapter(directory).run(['worktree', 'list', '--porcelain'], {
			timeoutMs: 3000,
			maxBuffer: 1024 * 1024
		});
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
		throw new ExpectedCliError('Use either --task or --loop/--step.');
	if (context.step && !context.loop) throw new ExpectedCliError('--step requires --loop.');
	const model = authorModel(context);
	if (!context.loop) return { ...context, agentModel: model };
	const state = await readLoop(loopPaths(root, context.loop).state);
	if (context.step && !state.steps.some((step) => step.id === context.step))
		throw new ExpectedCliError('Loop step does not exist.');
	return { ...context, agentModel: model ?? state.agentModel, loopRun: state.createdAt };
}
export async function recordAnalytics(
	event: Omit<AnalyticsEvent, 'id' | 'timestamp' | 'project'>,
	root = process.cwd()
): Promise<void> {
	if (process.env.HARNESS_ANALYTICS_DISABLED === '1') return;
	try {
		const repository = await AnalyticsRepository.open();
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
export function fingerprint(value: FingerprintValue): string {
	return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export async function validateReport(context: AnalyticsContext): Promise<void> {
	if (!context.report) return;
	if (!/^[a-zA-Z0-9-]+$/.test(context.report)) throw new ExpectedCliError('Invalid report ID.');
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
