import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { runHarness } from './support/cli';
import {
	commitGuidance,
	entity,
	guidanceProject,
	widgetManifest,
	writeGuidanceFile
} from './support/unitsGuidanceProject';

const roots: string[] = [];

afterEach(async () => {
	for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

test('a unit without scenarios still lists its implicit default as MISSING', async () => {
	const root = await guidanceProject();
	roots.push(root);
	await rm(join(root, 'specification/scenarios/widget-catalog.json'));
	const unit = widgetManifest();
	unit.scenarios = [];
	await writeGuidanceFile(root, 'specification/units/component.widget.json', JSON.stringify(unit));
	await commitGuidance(root);

	const result = await runHarness(['units', 'guide', entity], root, false);

	expect(result.exitCode).toBe(1);
	expect(result.stdout).toContain('MISSING default [REQUIRED]');
	expect(result.stdout).toContain('NEXT: default');
	expect(result.stdout).not.toContain('ALL DONE');
});
