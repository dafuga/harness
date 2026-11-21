// @harness-uid u_3ersk4crkf
import type { GuidanceOptions, GuideReport, GuideState } from './guideUnits.types';
import type { ExplorerCapture } from '../../../../packages/reports/src/models/explorer-ui/ExplorerEvidence.types';
import {
	allUnitStates,
	guidanceContext,
	guidanceUnit,
	headlessOnly,
	headlessStateNames,
	namedUnitStates
} from './guidanceContext';
import { unitStateName } from './contractStates';
import { stateTests } from './stateTests';
import { unitShots } from './unitShots';

const devices = ['desktop', 'tablet', 'mobile'];

/** @pure Whether a usable, passed assertion or trace capture proves this named unit state. */
export function recordedDone(captures: ExplorerCapture[], unitId: string, name: string): boolean {
	return captures.some(
		(item) =>
			item.usable &&
			item.capture.status === 'passed' &&
			(item.capture.kind === 'assertions' || item.capture.kind === 'trace') &&
			unitStateName(unitId, item.state) === name
	);
}

export async function guideUnits(id: string, options: GuidanceOptions = {}): Promise<GuideReport> {
	const context = await guidanceContext(options, true);
	const unit = guidanceUnit(context, id);
	const shots = await unitShots(context.loaded.root, id, context.tree.revision);
	const states: GuideState[] = [];
	const derived = await allUnitStates(context, unit);
	const headlessUnit = headlessOnly(context.loaded.scenarios, id, context.registries);
	const headlessNames = headlessStateNames(context.loaded.scenarios, id, context.registries);
	const namedDefault = namedUnitStates(context, unit).find((state) => state.name === 'default');
	const explicitDefault =
		namedDefault?.reasons.some((reason) => reason !== 'Default presentation.') ?? false;
	for (const state of derived.filter(
		(item) =>
			item.origin === 'REQUIRED' && (!headlessUnit || item.name !== 'default' || explicitDefault)
	)) {
		// Each state is classified on its own: a mixed unit has both headless and UI states.
		const isHeadless = headlessNames.includes(state.name);
		const tests = await stateTests(context, unit, state.name, { headless: isHeadless });
		if (isHeadless) {
			const evidence = recordedDone(shots.captures, id, state.name) ? 'DONE' : 'MISSING';
			states.push({
				...state,
				tests,
				viewports: {},
				evidence,
				status: tests.length > 0 && evidence === 'DONE' ? 'DONE' : 'MISSING'
			});
			continue;
		}
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
	const editPath = (test ?? 'tests/e2e/component-catalog.spec.ts').replaceAll("'", "'\\''");
	const next = first
		? {
				state: first.name,
				commands: [
					`\${EDITOR:-vi} '${editPath}' # Write/extend ${JSON.stringify(first.name)} for ${id}, then commit the test.`,
					`harness verify run --priority agent-test --entity ${id}`,
					`harness units guide ${id}`
				]
			}
		: null;
	return {
		entity: id,
		commit: context.tree.revision,
		states,
		guesses: derived.filter((state) => state.origin === 'GUESS'),
		summary: { done: states.length - missing.length, missing: missing.length },
		next,
		proof: { store: 'git', gap: shots.gap }
	};
}

export function renderUnitsGuide(report: GuideReport): string {
	if (report.states.length === 0)
		return [
			`${report.entity} @ ${report.commit}`,
			'No required states; completion is not established.',
			...(report.proof.gap ? [`Proof: ${report.proof.gap}`] : [])
		].join('\n');
	const rows = report.states.map(
		(state) =>
			`${state.status} ${state.name} [${state.origin}] test:${state.tests.length ? state.tests.map((test) => test.file).join(', ') : 'MISSING'} ${state.evidence ? `evidence:${state.evidence}` : devices.map((device) => `${device}:${state.viewports[device]}`).join(' ')}\n  ${state.reasons.join('; ')}`
	);
	return [
		`${report.entity} @ ${report.commit}`,
		'REQUIRED = named unit states; guesses are advisory and do not block DONE.',
		...rows,
		`${report.summary.done}/${report.states.length} DONE.`,
		...(report.proof.gap ? [`Proof: ${report.proof.gap}`] : []),
		...(report.next
			? [`NEXT: ${report.next.state}`, ...report.next.commands]
			: ['ALL DONE: inspect each retained screenshot before accepting the UI.']),
		...(report.guesses.length
			? [
					'GUESSES (advisory; declare a catalog state if justified):',
					...report.guesses.map((guess) => `  ? ${guess.name}: ${guess.reasons.join('; ')}`)
				]
			: [])
	].join('\n');
}
