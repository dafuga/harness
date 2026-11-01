import type { GuidanceOptions, GuideReport, GuideState } from './guideUnits.types';
import { allUnitStates, guidanceContext, guidanceUnit } from './guidanceContext';
import { unitStateName } from './contractStates';
import { stateTests } from './stateTests';
import { unitShots } from './unitShots';

const devices = ['desktop', 'tablet', 'mobile'];

export async function guideUnits(id: string, options: GuidanceOptions = {}): Promise<GuideReport> {
	const context = await guidanceContext(options, true);
	const unit = guidanceUnit(context, id);
	const shots = await unitShots(context.loaded.root, id, context.tree.revision);
	const states: GuideState[] = [];
	for (const state of await allUnitStates(context, unit)) {
		const tests = await stateTests(context, unit, state.name);
		const viewports: GuideState['viewports'] = {};
		for (const viewport of devices)
			viewports[viewport] = shots.captures.some(
				(shot) =>
					shot.usable &&
					shot.capture.status === 'passed' &&
					shot.capture.kind === 'screenshot' &&
					shot.capture.viewport === viewport &&
					unitStateName(id, shot.state) === state.name
			)
				? 'DONE'
				: 'MISSING';
		const done = tests.length > 0 && devices.every((device) => viewports[device] === 'DONE');
		states.push({ ...state, tests, viewports, status: done ? 'DONE' : 'MISSING' });
	}
	const missing = states.filter((state) => state.status === 'MISSING');
	const first = missing[0];
	const test = states.flatMap((state) => state.tests)[0]?.file;
	const next = first
		? {
				state: first.name,
				commands: [
					`\${EDITOR:-vi} '${test ?? 'tests/e2e/component-catalog.spec.ts'}' # Write/extend ${JSON.stringify(first.name)} for ${id}, then commit the test.`,
					`harness verify run --priority agent-test --entity ${id}`,
					`harness units guide ${id}`
				]
			}
		: null;
	return {
		entity: id,
		commit: context.tree.revision,
		states,
		summary: { done: states.length - missing.length, missing: missing.length },
		next,
		proof: { store: 'git', gap: shots.gap }
	};
}

export function renderUnitsGuide(report: GuideReport): string {
	const rows = report.states.map(
		(state) =>
			`${state.status} ${state.name} [${state.origin}] test:${state.tests.length ? state.tests.map((test) => test.file).join(', ') : 'MISSING'} ${devices.map((device) => `${device}:${state.viewports[device]}`).join(' ')}\n  ${state.reasons.join('; ')}`
	);
	return [
		`${report.entity} @ ${report.commit}`,
		'REQUIRED = repo declarations; GUESS = heuristic boundary to review.',
		...rows,
		`${report.summary.done}/${report.states.length} DONE.`,
		...(report.proof.gap ? [`Proof: ${report.proof.gap}`] : []),
		...(report.next
			? [`NEXT: ${report.next.state}`, ...report.next.commands]
			: ['ALL DONE: inspect each retained screenshot before accepting the UI.'])
	].join('\n');
}
