import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'vitest';
import {
	entity,
	guidanceJson,
	guidanceProject,
	widgetManifest,
	writeGuidanceFile
} from './unitsGuidanceProject';
import { videoEnrollment } from './videoEnrollmentFixture';

export async function motionRegistryProject(): Promise<string> {
	const root = await guidanceProject(['default', 'idle', 'busy']);
	const unit = widgetManifest();
	unit.contract.inputs = [{ name: 'Widget.mode', type: "'idle' | 'busy'", required: true }];
	unit.contract.outputs[0].description = 'Renders default, idle or busy content.';
	await writeGuidanceFile(root, 'specification/units/component.widget.json', JSON.stringify(unit));
	return root;
}

export async function assertPartialVideoRegistry(root: string): Promise<void> {
	const path = 'specification/scenarios/widget-catalog.json';
	const scenario = JSON.parse(await readFile(join(root, path), 'utf8'));
	scenario.states = scenario.states.map((state: { id: string }, index: number) => ({
		...state,
		motion: index === 0 ? 'required' : 'none',
		...(index ? { motionReason: 'This prop choice renders a static label.' } : {})
	}));
	scenario.video = videoEnrollment(entity, 'component-widget', scenario.viewports);
	scenario.evidence.push({
		id: 'motion',
		kind: 'video',
		states: ['component-widget'],
		viewports: scenario.viewports.map((viewport: { id: string }) => viewport.id),
		required: true
	});
	await writeGuidanceFile(root, path, JSON.stringify(scenario));
	for (const [file, text] of [
		['src/owner.ts', 'export const owner = true;'],
		['test/record.ts', 'export function record() {}'],
		['test/fixture.json', '{}']
	])
		await writeGuidanceFile(root, file, text);
	const { report } = await guidanceJson(root, ['check-contract', entity]);
	expect(
		report.findings,
		'a per-state video clip must not claim the whole component state list'
	).toEqual([]);
}
