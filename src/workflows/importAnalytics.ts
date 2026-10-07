import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { AnalyticsRepository } from '../repositories/AnalyticsRepository';
import type { LoopState } from '../workflows/loopState';
import type { AnalyticsEvent } from '../core/analyticsTypes';
import { fingerprint, projectIdentity } from './analyticsRecord';

export async function importAnalytics(root: string, historical = true): Promise<number> {
	const repository = new AnalyticsRepository();
	try {
		return await importDirectory(resolve(root), repository, historical);
	} finally {
		repository.close();
	}
}
async function importDirectory(
	root: string,
	repository: AnalyticsRepository,
	historical: boolean
): Promise<number> {
	let imported = await importProject(root, repository, historical);
	const entries = await readdir(root, { withFileTypes: true });
	for (const entry of entries) {
		if (
			!entry.isDirectory() ||
			['node_modules', 'dist', 'build', 'analytics'].includes(entry.name) ||
			entry.name.startsWith('.')
		)
			continue;
		imported += await importDirectory(join(root, entry.name), repository, historical);
	}
	return imported;
}
async function importProject(
	root: string,
	repository: AnalyticsRepository,
	historical: boolean
): Promise<number> {
	const directory = join(root, 'specification', 'loops');
	const names = await readdir(directory).catch(() => [] as string[]);
	if (!names.length) return 0;
	const project = await projectIdentity(root);
	await repository.reconcileHistorical(root, project);
	let imported = 0;
	for (const name of names) {
		try {
			const state = JSON.parse(
				await readFile(join(directory, name, 'loop.json'), 'utf8')
			) as LoopState;
			const text = await readFile(join(directory, name, 'trace.ndjson'), 'utf8').catch(() => '');
			const events = loopEvents(state, project, text, historical);
			for (const event of events) repository.recordImported(event);
			imported += events.length;
		} catch {
			console.error(`Warning: skipped unreadable loop ${name}.`);
		}
	}
	return imported;
}
function loopEvents(
	state: LoopState,
	project: string,
	text: string,
	historical: boolean
): AnalyticsEvent[] {
	const base = {
		project,
		loop: state.name,
		agentModel: state.agentModel,
		loopRun: state.createdAt,
		historical
	};
	const events: AnalyticsEvent[] = [
		makeEvent({
			...base,
			kind: 'loop',
			action: 'created',
			timestamp: state.createdAt,
			template: state.template
		})
	];
	for (const step of state.steps.filter((item) => item.completedAt)) {
		events.push(
			makeEvent({
				...base,
				kind: 'step',
				action: 'completed',
				step: step.id,
				timestamp: step.completedAt!
			})
		);
	}
	if (state.steps.length && state.steps.every((step) => step.status === 'complete')) {
		events.push(
			makeEvent({ ...base, kind: 'loop', action: 'completed', timestamp: state.updatedAt })
		);
	}
	events.push(...evaluationEvents(text, base));
	return events;
}
function makeEvent(event: Omit<AnalyticsEvent, 'id'>): AnalyticsEvent {
	return {
		...event,
		id: fingerprint([
			event.project,
			event.loop,
			event.kind,
			event.action,
			event.step,
			event.timestamp
		])
	};
}

function evaluationEvents(
	text: string,
	base: Pick<AnalyticsEvent, 'project' | 'loop' | 'loopRun' | 'agentModel' | 'historical'>
): AnalyticsEvent[] {
	const events: AnalyticsEvent[] = [];
	for (const line of text.split('\n').filter(Boolean)) {
		try {
			const event = JSON.parse(line) as {
				event: string;
				timestamp: string;
				passed?: boolean;
				durationMs?: number;
			};
			if (event.event === 'loop.evaluated')
				events.push(
					makeEvent({
						...base,
						kind: 'evaluation',
						action: 'evaluated',
						timestamp: event.timestamp,
						status: event.passed ? 'passed' : 'failed',
						durationMs: event.durationMs
					})
				);
		} catch {
			console.error('Warning: skipped malformed loop trace record.');
		}
	}
	return events;
}
