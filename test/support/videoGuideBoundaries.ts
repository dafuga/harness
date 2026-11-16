import { expect } from 'vitest';
import { unitVideoShots } from '../../src/workflows/development-tooling/guide-units/unitVideoShots';
import type { ExplorerCapture } from '../../packages/reports/src/models/explorer-ui/ExplorerEvidence.types';
import { videoGuideFixture } from './videoGuideFixture';

/** Guide completion requires compatible observed boundaries and a finished finite inventory. */
export function assertVideoGuideBoundaries() {
	const { entity, scenario, video, item, screenshot } = videoGuideFixture();
	expect(unitVideoShots([item, screenshot], [scenario], entity).captures).toHaveLength(2);
	const incompatible = {
		...item,
		capture: { ...item.capture, video: { ...video, exitSignature: 'f'.repeat(64) } }
	} as ExplorerCapture;
	expect(
		unitVideoShots([incompatible, screenshot], [scenario], entity).captures,
		'guide must reject incompatible observed video boundaries'
	).toHaveLength(0);
	const unknown = {
		...scenario,
		video: {
			...scenario.video!,
			discoveryGaps: [{ unit: entity, reason: 'Retry states await inventory.' }]
		}
	};
	const gaps = unitVideoShots([item, screenshot], [unknown], entity);
	expect(gaps.captures, 'unresolved discovery must keep the guide incomplete').toHaveLength(0);
	expect(gaps.gap).toContain('Retry states await inventory.');
}
