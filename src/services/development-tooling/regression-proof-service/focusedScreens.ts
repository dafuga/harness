import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fail } from '../../../core/errors';
import type { RegressionRecord } from '../../../core/regressionTypes';
import type { ScenarioManifest } from '../../../core/unitTypes';
import type { CaptureLine } from '../../../core/verifyTypes';
import type { Gathered } from '../../../utils/gatherCaptures';

/** Retain inspected pixels and resolve canonical evidence slots through their scenario contract. */
export async function focusedScreens(
	gathered: Gathered[],
	directory: string,
	context: { commit: string; scenarios: ScenarioManifest[] }
) {
	const captures: NonNullable<RegressionRecord['captures']> = [],
		files: Array<{ path: string; bytes: Buffer }> = [];
	for (const { line, capture, facts } of gathered.filter(
		(item) => item.capture.kind === 'screenshot'
	)) {
		if (!facts || 'error' in facts || facts.kind !== 'image')
			fail('Focused capture is not a decoded screenshot.');
		if (capture.provenance === 'actual-capture' && capture.server?.revision !== context.commit)
			fail('Focused capture has a different served revision.');
		for (const unit of captureUnits(line, context.scenarios))
			captures.push({ unit, capture, viewport: { width: facts.width, height: facts.height } });
		files.push({ path: capture.path, bytes: await readFile(join(directory, line.file)) });
	}
	return { captures, files };
}

/** An ambiguous slot never borrows another scenario's units; explicit unit identifiers still work. */
function captureUnits(line: CaptureLine, scenarios: ScenarioManifest[]): string[] {
	const matching = scenarios.filter((scenario) =>
		scenario.evidence.some(
			(evidence) =>
				evidence.id === line.evidence &&
				evidence.kind === 'screenshot' &&
				evidence.states.includes(line.state) &&
				evidence.viewports.includes(line.viewport ?? '')
		)
	);
	if (matching.length !== 1) return [line.evidence];
	const scenario = matching[0];
	return scenario.states.find((state) => state.id === line.state)?.units ?? scenario.units;
}
