import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import { scenarioManifestSchema } from '../../src/core/development-tooling/unitTypes';
import { VideoEvidenceService } from '../../src/services/verification-evidence/VideoEvidenceService';

/** Exercise the real enrolled scripts before any browser or snapshot setup can start. */
export function assertPilotVideoInputs() {
	for (const [id, slots] of [
		['loading-state-video-pilot', 3],
		['platform-interaction-video-pilot', 6],
		['platform-search-video-pilot', 48]
	] as const) {
		const scenario = scenarioManifestSchema.parse(
			JSON.parse(readFileSync(join(process.cwd(), 'specification/scenarios', `${id}.json`), 'utf8'))
		);
		let plan: ReturnType<VideoEvidenceService['plan']> | undefined;
		expect(() => {
			plan = new VideoEvidenceService().plan(scenario.video!);
		}, `pilot input closure ${id}`).not.toThrow();
		expect(plan?.record).toHaveLength(slots);
		const warm = new VideoEvidenceService().plan(scenario.video!, plan!.record);
		expect(warm.record, `declared pilot dependencies permit warm reuse ${id}`).toEqual([]);
		expect(warm.reuse).toHaveLength(slots);
	}
}
