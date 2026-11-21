import { commitGuidance, entity, writeGuidanceFile } from './unitsGuidanceProject';

export async function addGuidanceRecording(
	root: string,
	testPath: string,
	runner: 'command' | 'vitest',
	target = testPath
) {
	const state = 'component-widget-recorded';
	const scenario = {
		schemaVersion: 1,
		id: 'widget-recorded',
		title: 'Widget recorded assertions',
		kind: 'headless',
		units: [entity],
		states: [{ id: state, title: 'Recorded', coverage: 'required', units: [entity] }],
		viewports: [],
		tests: [{ id: 'recorded', kind: 'unit', runner, target }],
		evidence: [
			{ id: 'assertions', kind: 'assertions', states: [state], viewports: [], required: true }
		]
	};
	await writeGuidanceFile(
		root,
		'specification/scenarios/widget-recorded.json',
		JSON.stringify(scenario)
	);
	await writeGuidanceFile(root, testPath, "test('recorded', () => expect(true).toBe(true));");
	await commitGuidance(root);
}
