import { rm } from 'node:fs/promises';
import { afterEach, expect, test } from 'vitest';
import { entity, guidanceJson, guidanceProject } from './support/unitsGuidanceProject';
import { addGuidanceRecording } from './support/unitsGuidanceRecording';

const roots: string[] = [];
afterEach(async () => {
	for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

test('guide CLI gives a headless state no devices and keeps devices on UI states', async () => {
	const root = await guidanceProject(['default', 'loading']);
	roots.push(root);
	await addGuidanceRecording(
		root,
		'test/recorded.test.ts',
		'command',
		'bun test/verification-output.ts vitest test/recorded.test.ts'
	);

	const { exitCode, report } = await guidanceJson(root, ['guide', entity]);
	const state = (name: string) =>
		report.states.find((item: { name: string }) => item.name === name);
	const names = report.states.map((item: { name: string }) => item.name);

	expect(exitCode).toBe(1);
	expect(names).toEqual(['default', 'loading', 'recorded']);
	// The headless state has an evidence column (nothing recorded yet) and no devices.
	expect(state('recorded')).toMatchObject({
		status: 'MISSING',
		evidence: 'MISSING',
		tests: [{ file: 'test/recorded.test.ts', viewports: [] }]
	});
	expect(state('recorded').viewports).toEqual({});
	// UI states keep their desktop, tablet and mobile keys.
	for (const name of ['default', 'loading'])
		expect(state(name).viewports).toEqual({
			desktop: 'MISSING',
			tablet: 'MISSING',
			mobile: 'MISSING'
		});
});
