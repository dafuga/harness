import { expect, onTestFinished } from 'vitest';
import { rmSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { compatibilityFixture } from './trackerCliCompatibilityFixture';
import { createTempDirectory } from './temporary';
import { fixtureTrackerJson } from './trackerNodeProcess';
import type { TrackerNodeFixture } from './trackerNodeProcess.types';

export async function qualifyPlanningStages(spoke: TrackerNodeFixture, id: string) {
	expect(await fixtureTrackerJson(spoke, ['show', id])).toMatchObject({ stage: 'idea' });
	for (const stage of ['detail', 'design', 'build']) {
		expect(
			await fixtureTrackerJson(spoke, ['stage', id, stage, '--by', 'fixture-planner'])
		).toMatchObject({
			stage,
			planning: {
				promotions: expect.arrayContaining([
					{ stage, by: 'fixture-planner', at: expect.any(String) }
				])
			}
		});
	}
	expect(await fixtureTrackerJson(spoke, ['list', '--stage', 'build'])).toMatchObject([
		{ id, stage: 'build' }
	]);
}

export async function verifyArtifactCommand(
	run: Awaited<ReturnType<typeof compatibilityFixture>>['run']
) {
	const directory = await createTempDirectory('tracker-artifact-');
	onTestFinished(() => rmSync(directory, { recursive: true, force: true }));
	const file = join(directory, 'design.json');
	const design = {
		links: [{ label: 'Wireframe', url: 'https://example.test/wireframe.png', kind: 'image' }]
	};
	await writeFile(file, JSON.stringify(design));
	const saved = await run('artifact', 'taskfi', 'detail', file, '--json');
	expect(saved.code).toBe(0);
	expect(JSON.parse(saved.out)).toMatchObject({ planning: { artifacts: { detail: design } } });
}
