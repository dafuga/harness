// @harness-uid u_wlip653voz
import type { TrackerAdapterSourceFields } from './trackerAdapterSourceInput.types';
import type { TrackerAdapterSource } from '../../../repositories/projects-sessions/TrackerAdapterRepository.types';
import { normalizeTrackerCron } from '../../../utils/projects-sessions/normalizeTrackerCron';
import {
	trackerTimeZone,
	validateTrackerTimeZone
} from '../../../utils/projects-sessions/normalizeTrackerDue';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';

const kinds = ['task', 'plan', 'goal', 'recurring'];
const buildflexity = 'dafuga/buildflexity';

/** Validate a proposed GitHub source. Activation starts on a whole second, as GitHub times do. */
export function trackerAdapterSourceInput(
	input: TrackerAdapterSourceFields,
	now: number
): TrackerAdapterSource & { enabled_at: number } {
	if (input.type !== 'github') throw trackerItemError('unknown adapter type');
	const agent = word(input, 'agent');
	if (!agent) throw trackerItemError('adapter requires an agent');
	const project = word(input, 'project') || agent;
	const target = githubTarget(word(input, 'target').toLowerCase(), project);
	return {
		id: `github:${target}`,
		type: 'github',
		target,
		agent,
		project,
		...workSettings(input, now),
		computer: computerName(input),
		owner: word(input, 'owner') || null,
		model: word(input, 'model') || null,
		include_labels: labels(input, 'include_labels'),
		exclude_labels: labels(input, 'exclude_labels'),
		enabled_at: Math.ceil(now / 1000) * 1000,
		cursor: Math.ceil(now / 1000) * 1000,
		paused: false
	};
}

function word(input: TrackerAdapterSourceFields, key: string): string {
	return String(input[key] ?? '').trim();
}

function githubTarget(target: string, project: string): string {
	if (!/^[a-z0-9][a-z0-9-]*\/[a-z0-9_.-]+$/.test(target) || /\/(?:\.|\.\.)$/.test(target))
		throw trackerItemError('GitHub repo must be OWNER/REPO');
	if (target === buildflexity && project.toLowerCase() !== 'buildflexity')
		throw trackerItemError(`${buildflexity} uses the buildflexity project`);
	return target;
}

function workSettings(input: TrackerAdapterSourceFields, now: number) {
	const kind = word(input, 'kind') || 'task';
	const autoLaunch = word(input, 'auto_launch') || 'never';
	if (!kinds.includes(kind))
		throw trackerItemError('adapter kind must be task, plan, goal or recurring');
	if (!['never', 'unlabeled'].includes(autoLaunch))
		throw trackerItemError('auto-launch must be never or unlabeled');
	if (kind !== 'task' && autoLaunch !== 'never')
		throw trackerItemError('only tasks can auto-launch');
	return { kind, auto_launch: autoLaunch, ...schedule(input, kind, now) };
}

function schedule(input: TrackerAdapterSourceFields, kind: string, now: number) {
	const every = word(input, 'every');
	const zone = word(input, 'every_tz');
	if (kind !== 'recurring') {
		if (every || zone) throw trackerItemError('adapter schedules require --kind recurring');
		return {};
	}
	const every_tz = zone || trackerTimeZone;
	try {
		validateTrackerTimeZone(every_tz);
		return { every: normalizeTrackerCron(every, every_tz, now), every_tz };
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		throw trackerItemError(`invalid adapter schedule: ${reason}`);
	}
}

function computerName(input: TrackerAdapterSourceFields): string {
	const computer = word(input, 'computer').toLowerCase() || 'auto';
	if (!/^[a-z0-9][a-z0-9_-]*$/.test(computer)) throw trackerItemError('invalid adapter computer');
	return computer;
}

function labels(input: TrackerAdapterSourceFields, key: string): string[] {
	const names = word(input, key)
		.split(',')
		.map((name) => name.trim().toLowerCase());
	return [...new Set(names.filter(Boolean))];
}
