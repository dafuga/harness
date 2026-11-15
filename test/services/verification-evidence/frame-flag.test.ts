import { expect, test } from 'vitest';
import { FrameFlagService } from '../../../src/services/verification-evidence/FrameFlagService';
import { withTempRepo } from '../../support/temporary';
import { frameFlagFixture, hash } from '../../support/frameFlagFixture';
import { LfsAdapter } from '../../../src/adapters/git-source-history/LfsAdapter';
import { EvidenceBranchRepository } from '../../../src/repositories/verification-evidence/evidence-branch-repository/EvidenceBranchRepository';
import { mediaFacts } from '../../../src/utils/verification-evidence/mediaFacts';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { measureWorkload } from '../../support/measureWorkload';
import { attachedFrameFixture } from '../../support/attachedFrameFixture';

test('FrameFlagService runs', () => {
	expect(new FrameFlagService().run()).toBe('frame-flag');
});

test('flag stores an exact version-bound extracted frame in Git evidence and LFS', async () => {
	await withTempRepo(async ({ root, git }) => {
		const f = await frameFlagFixture(root, git),
			service = new FrameFlagService(root, f.reader);
		const sourceTree = git('write-tree');
		const flag = await measureWorkload(
			'service.verification-evidence-frame-flag',
			'flag-extract-persist',
			() =>
				service.flag({
					clip: f.reference,
					atSeconds: 0.2,
					note: 'Spinner jumps',
					region: { x: 0.1, y: 0.2, width: 0.5, height: 0.5 }
				})
		);
		expect(flag).toMatchObject({
			schemaVersion: 1,
			atSeconds: 0.2,
			frameNumber: 2,
			note: 'Spinner jumps',
			status: 'active',
			source: 'human',
			clip: { ...f.reference, sha256: hash(f.original), inputHash: 'c'.repeat(64) }
		});
		const bytes = await new LfsAdapter(root).read(flag.frame.sha256);
		expect(bytes).toBeDefined();
		expect(hash(bytes!)).toBe(flag.frame.sha256);
		expect(mediaFacts(bytes!, 'image/png')).toEqual({ kind: 'image', width: 160, height: 120 });
		const evidence = new EvidenceBranchRepository(root);
		expect(
			(await evidence.tree.read(
				(await evidence.tip())!,
				`${flag.evidence.path}/frame.png`
			))!.toString()
		).toContain('git-lfs.github.com/spec/v1');
		expect(git('status', '--porcelain')).toBe('');
		expect(git('rev-parse', 'HEAD')).toBe(f.reference.revision);
		expect(git('write-tree')).toBe(sourceTree);
	});
});

test('flag validates timeline bounds, normalized regions, ownership and reviewer notes', async () => {
	await withTempRepo(async ({ root, git }) => {
		const f = await frameFlagFixture(root, git),
			service = new FrameFlagService(root, f.reader);
		for (const invalid of [
			{},
			{ atSeconds: -1 },
			{ atSeconds: 1 },
			{ frameNumber: 10 },
			{ frameNumber: 2.5 },
			{ atSeconds: 0.2, frameNumber: 7 },
			{ atSeconds: 0.2, note: 'x'.repeat(2001) },
			{ atSeconds: 0.2, region: { x: 0.95, y: 0, width: 0.2, height: 0.5 } }
		])
			await expect(service.flag({ clip: f.reference, ...invalid })).rejects.toThrow();
		await expect(
			service.flag({ clip: { ...f.reference, unit: 'component.other' }, atSeconds: 0.2 })
		).rejects.toThrow();
		const flag = await service.flag({ clip: f.reference, frameNumber: 2, source: 'automated' });
		expect(flag).toMatchObject({ atSeconds: 0.2, frameNumber: 2, source: 'automated', note: '' });
	});
});

test('list survives a new service and distinguishes stale flags without deleting history', async () => {
	await withTempRepo(async ({ root, git }) => {
		const f = await frameFlagFixture(root, git);
		const flag = await new FrameFlagService(root, f.reader).flag({
			clip: f.reference,
			atSeconds: 0.2
		});
		const service = new FrameFlagService(root, f.reader);
		expect(await service.list('component.other')).toEqual([]);
		expect((await service.list('component.player'))[0]).toMatchObject({
			id: flag.id,
			status: 'active'
		});
		expect(
			(
				await service.list('component.player', [
					{ clipId: 'play', viewport: 'desktop', sha256: hash(f.replacement) }
				])
			)[0]
		).toMatchObject({ id: flag.id, status: 'stale' });
	});
});

test('feedback materializes hash-verified images and notes only for the owning unit', async () => {
	await withTempRepo(async ({ root, git }) => {
		const f = await frameFlagFixture(root, git),
			service = new FrameFlagService(root, f.reader);
		const flag = await service.flag({
			clip: f.reference,
			atSeconds: 0.2,
			note: 'Inspect this edge'
		});
		const feedback = await service.feedback('component.player', join(root, '.cache/inputs'));
		expect(feedback.flags).toEqual([flag.id]);
		expect(feedback.images).toHaveLength(1);
		for (const value of [flag.id, 'play', '0.2', 'Inspect this edge', flag.clip.sha256])
			expect(feedback.text).toContain(value);
		expect(hash(await readFile(feedback.images[0]))).toBe(flag.frame.sha256);
		expect(await service.frame('component.player', flag.id)).toEqual(
			await readFile(feedback.images[0])
		);
		await expect(service.frame('component.other', flag.id)).rejects.toThrow(/owner|found/i);
		expect(await service.feedback('component.other', join(root, '.cache/other'))).toEqual({
			text: '',
			images: [],
			flags: []
		});
		expect(git('status', '--porcelain')).toBe('');
	});
});

test('corrupt retained frame objects are refused before model feedback is assembled', async () => {
	await withTempRepo(async ({ root, git }) => {
		const f = await frameFlagFixture(root, git),
			service = new FrameFlagService(root, f.reader);
		const flag = await service.flag({ clip: f.reference, atSeconds: 0.2 });
		await writeFile(await new LfsAdapter(root).path(flag.frame.sha256), 'corrupt');
		await expect(service.feedback('component.player', join(root, '.cache/inputs'))).rejects.toThrow(
			/hash|integrity|corrupt/i
		);
	});
});

test('replacement recordings must address pending flags and resolve them append-only', async () => {
	await withTempRepo(async ({ root, git }) => {
		const f = await frameFlagFixture(root, git),
			service = new FrameFlagService(root, f.reader);
		const flag = await service.flag({ clip: f.reference, atSeconds: 0.2 });
		await expect(service.address(f.replacementRef)).rejects.toThrow(/address|pending/i);
		f.address([flag.id]);
		await service.address(f.replacementRef);
		expect((await service.list('component.player'))[0]).toMatchObject({
			id: flag.id,
			status: 'resolved'
		});
		const tip = await new EvidenceBranchRepository(root).tip();
		await service.address(f.replacementRef);
		expect(await new EvidenceBranchRepository(root).tip()).toBe(tip);
		expect(await service.feedback('component.player', join(root, '.cache/inputs'))).toEqual({
			text: '',
			images: [],
			flags: []
		});
	});
});

test('the default reader refuses clip references without attached verified evidence', async () => {
	await withTempRepo(async ({ root, git }) => {
		const f = await frameFlagFixture(root, git);
		await expect(
			new FrameFlagService(root).flag({ clip: f.reference, atSeconds: 0.2 })
		).rejects.toThrow(/attach|evidence|record/i);
		for (const standing of ['full', 'scoped', 'wrong-owner', 'failed'] as const) {
			const clip = await attachedFrameFixture({
				root,
				git,
				reference: f.reference,
				video: f.original,
				standing
			});
			const flag = new FrameFlagService(root).flag({ clip, atSeconds: 0.2 });
			if (standing === 'full' || standing === 'scoped')
				expect(await flag, 'valid attached clip supports frame feedback').toMatchObject({
					clip: { record: clip.record, revision: f.reference.revision },
					frameNumber: 2
				});
			else await expect(flag).rejects.toThrow(/pass|scope|verification/i);
		}
	});
});
