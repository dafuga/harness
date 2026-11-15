import { expect } from 'vitest';
import type { ScenarioManifest } from '../../src/core/unitTypes';
import type { Gathered } from '../../src/utils/verification-evidence/gatherCaptures';
import { scenarioCoverage } from '../../src/workflows/verification-evidence/run-verify/verification-service/scenarioCoverage';

/** The existing video graph matrix also requires explicit owning reviewer acknowledgments. */
export function assertPendingVideoFlagCoverage(scenario: ScenarioManifest, item: Gathered) {
	const requirements = pendingRequirements(item);
	const [owner, other] = requirements.known;
	const judge = (
		addressedFlags: string[],
		pendingVideoFlags = requirements,
		capturedAt = '2026-11-01T10:00:01Z'
	) => {
		const video = { ...item.line.video!, addressedFlags };
		return scenarioCoverage({
			scenario,
			commit: 'a'.repeat(40),
			gathered: [
				{ ...item, line: { ...item.line, video }, capture: { ...item.capture, video, capturedAt } }
			],
			checkFailed: false,
			builds: { declared: ['reports'], compiled: new Map([['reports', 'build-1']]) },
			videoSlots: [
				{ unit: video.unit, clipId: video.clipId, viewport: 'desktop', inputHash: video.inputHash }
			],
			pendingVideoFlags
		}).failures;
	};
	expect(judge([]).join(' '), 'unaddressed reviewer flags must block valid media').toMatch(
		/pending.*flag|flag.*pending/i
	);
	expect(judge([owner.id])).toEqual([]);
	expect(judge([owner.id, other.id]).join(' ')).toMatch(/unknown|owner/i);
	expect(judge([owner.id, '33333333-3333-4333-8333-333333333333']).join(' ')).toMatch(
		/unknown|owner/i
	);
	expect(judge([owner.id], requirements, '2026-10-01T10:00:00Z').join(' ')).toMatch(
		/predates|older|before/i
	);
	expect(judge([owner.id], { known: [owner], pending: [] })).toEqual([]);
	const anotherViewport = {
		...owner,
		id: '44444444-4444-4444-8444-444444444444',
		viewport: 'mobile',
		note: 'Mobile only'
	};
	expect(
		judge([owner.id], {
			known: [owner, anotherViewport],
			pending: [{ ...owner, note: 'Fix' }, anotherViewport]
		})
	).toEqual([]);
}

function pendingRequirements(item: Gathered) {
	const owner = {
		id: '11111111-1111-4111-8111-111111111111',
		unit: item.line.video!.unit,
		clipId: item.line.video!.clipId,
		viewport: 'desktop',
		createdAt: '2026-11-01T10:00:00Z'
	};
	const other = { ...owner, id: '22222222-2222-4222-8222-222222222222', unit: 'component.other' };
	return {
		known: [owner, other],
		pending: [
			{ ...owner, note: 'Fix this transition' },
			{ ...other, note: 'Other owner' }
		]
	};
}
