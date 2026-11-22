import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { videoEnrollment } from './videoEnrollmentFixture';
import { entity, writeGuidanceFile } from './unitsGuidanceProject';

/** Add explicit video requirements to the same committed guidance fixture. */
export async function enrollGuidanceVideo(root: string): Promise<void> {
	const path = 'specification/scenarios/widget-catalog.json';
	const enrolled = JSON.parse(await readFile(join(root, path), 'utf8'));
	enrolled.states = enrolled.states.map((state: { id: string }) => ({
		...state,
		motion: 'required'
	}));
	enrolled.video = videoEnrollment(entity, 'component-widget', enrolled.viewports);
	enrolled.states[1].motion = 'none';
	enrolled.states[1].motionReason = 'Static label';
	enrolled.evidence.push({
		id: 'video',
		kind: 'video',
		states: ['component-widget'],
		viewports: ['desktop', 'tablet', 'mobile'],
		required: true
	});
	await writeGuidanceFile(root, path, JSON.stringify(enrolled));
	for (const [file, text] of [
		['src/owner.ts', 'export const owner = true;'],
		['test/record.ts', 'export function record() {}'],
		['test/fixture.json', '{}']
	])
		await writeGuidanceFile(root, file, text);
}
