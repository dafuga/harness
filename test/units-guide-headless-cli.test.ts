import { rm } from 'node:fs/promises';
import { afterEach, expect, test } from 'vitest';
import {
	commitGuidance,
	entity,
	guidanceJson,
	guidanceProject,
	writeGuidanceFile
} from './support/unitsGuidanceProject';

const roots: string[] = [];
afterEach(async () => {
	for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

test('guide CLI gives a headless state no devices and keeps devices on UI states', async () => {
	const root = await guidanceProject(['default', 'loading']);
	roots.push(root);
	await writeGuidanceFile(
		root,
		'specification/scenarios/widget-recorded.json',
		JSON.stringify({
			schemaVersion: 1,
			id: 'widget-recorded',
			title: 'Widget recorded assertions',
			kind: 'headless',
			units: [entity],
			states: [
				{
					id: 'component-widget-recorded',
					title: 'Recorded',
					coverage: 'required',
					units: [entity]
				}
			],
			viewports: [],
			tests: [
				{
					id: 'recorded',
					kind: 'unit',
					runner: 'command',
					target: 'bun test/verification-output.ts vitest test/recorded.test.ts'
				}
			],
			evidence: [
				{
					id: 'assertions',
					kind: 'assertions',
					states: ['component-widget-recorded'],
					viewports: [],
					required: true
				}
			]
		})
	);
	await writeGuidanceFile(
		root,
		'test/recorded.test.ts',
		"test('recorded', () => expect(true).toBe(true));"
	);
	await commitGuidance(root);

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
