import type { HarnessRevision, HarnessUnit } from '../src/models/Harness.types';
import type { FocusedAudioFixture, FocusedAudioSlot } from './focusedAudioExamples.types';
import { capture } from './entityUnits';

/** Synthetic sealed-audio metadata only; this fixture produces no recording or passing verdict. */
export function focusedAudioFixture(
	detail: HarnessRevision,
	slots: FocusedAudioSlot[] = [{ evidence: 'generated-clip', caseId: 'generate.initialized' }],
	status: 'passed' | 'failed' = 'passed'
): FocusedAudioFixture {
	const unit: HarnessUnit = {
		...detail.registry.units[0],
		id: 'app.service.clip',
		kind: 'service',
		title: 'ClipService',
		owns: { source: ['src/services/ClipService.ts'], symbols: ['ClipService.generate'] },
		sourceFiles: [],
		testFiles: []
	};
	const captures = slots.map((slot) => syntheticAudioCapture(detail.commit, unit.id, slot));
	return {
		unit,
		detail: {
			...detail,
			records: [],
			registry: { ...detail.registry, units: [...detail.registry.units, unit] },
			regressions: [
				{
					loop: 'synthetic-class-audio',
					units: [unit.id],
					red: null,
					green: {
						id: 'synthetic-class-audio-record',
						commit: detail.commit,
						status,
						command: 'synthetic class artifact fixture',
						assertion: 'authored audio selection matrix',
						output: 'synthetic metadata only',
						finishedAt: '2026-10-21T10:00:00Z',
						captures
					}
				}
			]
		}
	};
}

function syntheticAudioCapture(
	commit: string,
	unit: string,
	{ evidence, caseId }: FocusedAudioSlot
) {
	const seed = capture(commit, { kind: 'audio', state: 'generated' });
	const audio = {
		...seed,
		kind: 'audio' as const,
		provenance: 'fixture' as const,
		evidence,
		bytes: 1,
		note: JSON.stringify({
			unit,
			case: caseId,
			revision: commit,
			sha256: seed.sha256
		})
	};
	return { unit, capture: audio };
}
