/** Each state calls verifyPlan on a Git fixture; its arguments and its report or error are recorded. */
export const unitId = 'workflow.verification-evidence-run-verify-verify-plan-workflow';

export const examplesCommand = `bun test/verification-output.ts vitest test/examples/${unitId}.test.ts`;

export const scenario = {
	schemaVersion: 1,
	id: `examples-${unitId}`,
	title: `${unitId} examples`,
	kind: 'headless',
	units: [unitId],
	builds: [],
	states: [{ id: 'entity-plan', title: 'Entity plan', coverage: 'required' }],
	viewports: [],
	tests: [{ id: 'examples', kind: 'unit', runner: 'command', target: examplesCommand, cwd: '.' }],
	evidence: [
		{ id: 'examples-cases', kind: 'trace', states: ['entity-plan'], viewports: [], required: true }
	]
};
