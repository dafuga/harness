import { expect } from 'vitest';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { withTempRepo } from './temporary';
import { videoSharedParent } from './videoSharedParent';
import { FrameFlagService } from '../../src/services/verification-evidence/FrameFlagService';
import { defaultAttachedReader } from '../../src/services/verification-evidence/frame-flag-service/flagMedia';
import { HistoryStatusService } from '../../src/services/verification-evidence/history-status-service/HistoryStatusService';
import { LfsAdapter } from '../../src/adapters/git-source-history/LfsAdapter';
import { hash } from './frameFlagFixture';

export async function assertSelectedFrameReader(): Promise<void> {
	await withTempRepo(async ({ root, git }) => {
		const f = await videoSharedParent(root, git);
		await rm(await new LfsAdapter(root).path(f.captures[1].sha256));
		const history = new HistoryStatusService(root);
		expect((await history.status(f.parent.source.commit)).verified).toBe(false);
		expect((await history.attached.load(f.evidence)).problems.join(' ')).toMatch(
			/missing|integrity/i
		);
		const reference = {
			record: f.parent.id,
			revision: f.parent.source.commit,
			unit: f.capture.video!.unit,
			clipId: f.capture.video!.clipId,
			viewport: f.capture.viewport!
		};
		const service = new FrameFlagService(root);
		const flag = await service.flag({ clip: reference, frameNumber: 2, note: 'Healthy A edge' });
		expect(flag, 'healthy selected archive clip supports frame feedback').toMatchObject({
			clip: { ...reference, sha256: f.capture.sha256 },
			frameNumber: 2
		});
		const png = await service.frame(reference.unit, flag.id);
		expect(hash(png)).toBe(flag.frame.sha256);
		const feedback = await service.feedback(reference.unit, join(root, '.cache/selected-feedback'));
		expect(feedback.flags).toEqual([flag.id]);
		expect(feedback.text).toContain('Healthy A edge');
		expect(await readFile(feedback.images[0])).toEqual(png);
		await expect(
			service.flag({ clip: { ...reference, clipId: 'sibling' }, frameNumber: 2 })
		).rejects.toThrow(/missing|integrity|corrupt/i);
		await expect(
			defaultAttachedReader(reference, root, {
				evidence: f.pointers[0].evidence.commit,
				notes: null
			})
		).rejects.toThrow(/attach|evidence|record/i);
		for (const invalid of [
			{ ...reference, unit: 'component.other' },
			{ ...reference, record: 'f'.repeat(64) },
			{ ...reference, revision: f.child.record.source.commit },
			{ ...reference, viewport: 'unknown' }
		])
			await expect(service.flag({ clip: invalid, frameNumber: 2 })).rejects.toThrow();
	});
}
