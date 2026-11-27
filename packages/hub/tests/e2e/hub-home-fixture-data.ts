import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import type {
	HomePlanState,
	HomeRun,
	OwnerHomeSnapshot
} from '../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';
import {
	buildHomeSnapshot,
	noProviders
} from '../../../reports/src/lib/projects-sessions/hub-home/homeTrackerProjection';
import { readRecordedHomeTracker } from '../../test/support/hubHomeTrackerRecording';
import type { HomeFixtureState, MockupHomeData } from './hub-home-fixture.types';
import { at, homeClock, quotas } from './hub-home-fixture-quota';
export { homeClock } from './hub-home-fixture-quota';

const fixtures = createContext({ window: {} });
runInContext("Object.defineProperty(globalThis, 'HH', { get: () => window.HH })", fixtures);
for (const name of ['data', 'data-work', 'data-busy', 'data-quota']) {
	const file = resolve(
		import.meta.dirname,
		'../../../../specification/designs/hub-home/mockup',
		name + '.js'
	);
	runInContext(readFileSync(file, 'utf8'), fixtures, { filename: file, timeout: 1000 });
}

export function mockup(state: HomeFixtureState): MockupHomeData {
	return fixtures.window.HH.data[
		state === 'loading' || state === 'unavailable' ? 'default' : state
	];
}

const planState: Record<string, HomePlanState> = {
	draft: 'draft',
	review: 'in-review',
	approved: 'approved',
	active: 'in-progress',
	done: 'done'
};

function scheduled(data: MockupHomeData): HomeRun[] {
	return data.scheduled.map((run, index) => {
		const days =
			run.day === 'Today' ? 0 : run.day === 'Tomorrow' ? 1 : run.day.startsWith('Mon') ? 2 : 10;
		const [hours, minutes] = run.time.split(':').map(Number);
		return {
			id: `run-${index}`,
			title: run.title,
			agent: run.agent,
			machine: run.machine,
			at: at(days * 1440 + hours * 60 + minutes - 1350),
			source: index % 3 === 1 ? 'claude' : 'tracker',
			recurring: run.repeat !== 'Once',
			paused: Boolean(run.paused)
		};
	});
}

export async function homeData(
	data: MockupHomeData,
	mode: HomeFixtureState,
	withoutChoices: boolean
): Promise<OwnerHomeSnapshot> {
	const sources =
		mode === 'empty' ? { items: [], runs: [], machines: [] } : await readRecordedHomeTracker();
	if (sources && withoutChoices) {
		for (const item of sources.items) delete item.options;
	}
	const { agents, openAsks, overview, projectDirectory } = buildHomeSnapshot(
		sources,
		noProviders,
		homeClock
	);
	const schedule = scheduled(data);
	return {
		overview,
		agents,
		openAsks,
		...(mode !== 'empty' && { projectDirectory }),
		plans: data.plans.map((plan, index) => ({
			id: `plan-${index}`,
			title: plan.title,
			project: plan.project,
			state: planState[plan.status],
			updatedAt: at(-20),
			done: plan.done,
			total: plan.steps,
			steps: [
				'Review current behavior',
				'Implement the approved design',
				'Verify all viewports',
				'Record evidence'
			].map((title, pos) => ({ id: `step-${pos}`, title, done: pos < plan.done }))
		})),
		scheduled: schedule,
		providers: {
			routines: schedule.filter((run) => run.source === 'claude'),
			routinesReadAt: at(-2),
			quota: quotas(data)
		}
	};
}
