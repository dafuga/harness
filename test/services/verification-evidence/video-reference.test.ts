import { expect, test } from 'vitest';
import { VideoReferenceService } from '../../../src/services/verification-evidence/VideoReferenceService';
import { withTempRepo } from '../../support/temporary';
import {
	videoReferenceFixture,
	referenceRecord,
	saveVideoParent,
	reusedVideoParent
} from '../../support/videoReferenceFixture';
import { EvidenceAttachService } from '../../../src/services/verification-evidence/evidence-attach-service/EvidenceAttachService';
import { HistoryStatusService } from '../../../src/services/verification-evidence/history-status-service/HistoryStatusService';
import { EvidenceRestoreService } from '../../../src/services/verification-evidence/EvidenceRestoreService';
import { VerificationCheckService } from '../../../src/services/verification-evidence/VerificationCheckService';
import { FrameFlagService } from '../../../src/services/verification-evidence/FrameFlagService';
import { LfsAdapter } from '../../../src/adapters/git-source-history/LfsAdapter';
import { recordFiles } from '../../../src/utils/verification-evidence/evidenceManifest';
import { recordLineage } from '../../../src/utils/development-tooling/recordLineage';
import { hash } from '../../support/frameFlagFixture';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { measureWorkload } from '../../support/measureWorkload';
import {
	rejectVideoOriginStandings,
	verifyMissingMediaDiscovery
} from '../../support/videoReferenceChecks';
import { scopeFailure } from '../../../src/workflows/verification-evidence/run-verify/verification-service/entityScope';

test('VideoReferenceService runs', () => {
	expect(new VideoReferenceService().run()).toBe('video-reference');
	expect(typeof new VideoReferenceService().resolve).toBe('function');
});

test('fresh archive captures attach without copied media and restore verified virtual file keys', async () => {
	await withTempRepo(async ({ root, git }) => {
		const f = await videoReferenceFixture(root, git);
		expect(recordFiles(f.record).map((file) => file.path)).toEqual(['check.log']);
		const trusted = await measureWorkload(
			'service.verification-evidence-video-reference',
			'resolve-parent-clip',
			() =>
				new VideoReferenceService(root).resolve({
					source: f.record.source,
					capture: f.capture,
					batches: f.pointers
				})
		);
		expect(trusted.origin).toMatchObject({
			revision: f.input.original.revision,
			buildId: f.input.original.buildId
		});
		expect(trusted.inputHash).toBe(f.input.video.inputHash);
		const attached = await new EvidenceAttachService(root).attach(f.record.source.commit, f.stored);
		const loaded = await new HistoryStatusService(root).attached.load(attached.evidence);
		expect(loaded.problems).toEqual([]);
		expect(loaded.manifest!.files.map((file) => file.path)).toEqual(['record.json', 'check.log']);
		expect(hash(loaded.files.get(f.capture.path)!)).toBe(f.capture.sha256);
		expect(hash(loaded.files.get('clips/play/poster.png')!)).toBe(f.capture.video!.poster.sha256);
		const flag = await new FrameFlagService(root).flag({
			clip: {
				revision: f.record.source.commit,
				record: f.record.id,
				unit: f.capture.video!.unit,
				clipId: f.capture.video!.clipId,
				viewport: f.capture.viewport!
			},
			frameNumber: 0
		});
		expect(flag.clip.sha256).toBe(f.capture.sha256);
		await rm(join(root, '.cache/harness/verifications'), { recursive: true, force: true });
		expect((await new EvidenceRestoreService(root).restore()).restored).toContain(f.record.id);
		expect(hash(await readFile(join(f.stored.directory, f.capture.path)))).toBe(f.capture.sha256);
		await verifyMissingMediaDiscovery(root, f.record, attached.evidence);
	});
}, 30_000);

test('a new parent keeps original clip metadata and admits only successful exact-owner origin proof', async () => {
	await withTempRepo(async ({ root, git }) => {
		const f = await videoReferenceFixture(root, git),
			attach = new EvidenceAttachService(root);
		const scoped = referenceRecord({
			source: f.record.source,
			capture: f.capture,
			pointers: f.pointers,
			components: f.record.components,
			failures: [scopeFailure(f.capture.video!.unit)]
		});
		await attach.attach(scoped.source.commit, await saveVideoParent(root, scoped));
		const child = await reusedVideoParent(root, git, scoped);
		const trusted = await new VideoReferenceService(root).resolve({
			source: child.record.source,
			capture: child.capture,
			batches: f.pointers
		});
		expect(trusted.origin).toMatchObject({ record: scoped.id, revision: scoped.source.commit });
		expect(child.record.scenarios[0].testedRevision).toBe(child.record.source.commit);
		expect(child.capture.server!.revision).toBe(scoped.source.commit);
		expect(recordLineage(child.record, { find: () => scoped, problems: () => [] })).toEqual([]);
		const attached = await attach.attach(child.record.source.commit, child.stored);
		expect(
			(await new HistoryStatusService(root).status(child.record.source.commit)).records[0].valid
		).toBe(true);
		expect(
			(await new HistoryStatusService(root).attached.load(attached.evidence)).files.get(
				child.capture.path
			)
		).toEqual(f.input.videoBytes);
		const candidates = await new VideoReferenceService(root).candidates({
			unit: f.capture.video!.unit,
			clipId: f.capture.video!.clipId,
			viewport: f.capture.viewport!,
			inputHash: f.input.video.inputHash
		});
		expect(candidates[0].parent.record).toBe(child.record.id);
		await rejectVideoOriginStandings(root, scoped, child.record);
	});
}, 30_000);

test('reference proof rejects changed metadata, identity, paths, ancestry and missing original parents', async () => {
	await withTempRepo(async ({ root, git }) => {
		const f = await videoReferenceFixture(root, git, true),
			service = new VideoReferenceService(root);
		await writeFile(
			await new LfsAdapter(root).path(hash(f.input.alternateVideo)),
			'corrupt sibling'
		);
		expect(
			(await service.resolve({ source: f.record.source, capture: f.capture, batches: f.pointers }))
				.inputHash
		).toBe(f.input.video.inputHash);
		for (const record of [
			{ ...f.record, components: [] },
			{ ...f.record, builds: [] }
		]) {
			const result = await service.materialize(record).then(
				() => 'accepted',
				(error: unknown) => (error instanceof Error ? error.message : 'unknown failure')
			);
			expect(result).toMatch(/owner|component|build/i);
		}
		for (const capture of [
			{ ...f.capture, path: '../escape.mp4' },
			{ ...f.capture, bytes: f.capture.bytes + 1 },
			{ ...f.capture, sha256: 'd'.repeat(64) },
			{ ...f.capture, video: { ...f.capture.video!, inputHash: 'd'.repeat(64) } },
			{ ...f.capture, server: { ...f.capture.server!, buildId: 'd'.repeat(64) } },
			{ ...f.capture, videoReference: { batch: 'd'.repeat(64) } },
			{
				...f.capture,
				videoReference: {
					...f.capture.videoReference!,
					record: 'd'.repeat(64),
					revision: f.record.source.commit
				}
			}
		])
			await expect(
				service.resolve({ source: f.record.source, capture, batches: f.pointers })
			).rejects.toThrow();
		await expect(
			new VideoReferenceService(root, { evidence: f.record.source.commit, notes: null }).resolve({
				source: f.record.source,
				capture: f.capture,
				batches: f.pointers
			})
		).rejects.toThrow();
		await writeFile(await new LfsAdapter(root).path(f.capture.sha256), 'corrupt');
		expect(
			await new VerificationCheckService(root).integrity(f.record.source.commit, f.stored)
		).toEqual(expect.arrayContaining([expect.stringMatching(/video|hash|integrity/i)]));
	});
}, 30_000);

test('clip lineage preserves every original binding and refuses missing, damaged and cyclic ancestry', async () => {
	await withTempRepo(async ({ root, git }) => {
		const f = await videoReferenceFixture(root, git),
			child = await reusedVideoParent(root, git, f.record);
		const source = { find: () => f.record, problems: () => [] };
		expect(recordLineage(child.record, source)).toEqual([]);
		for (const origin of [
			{ ...f.record, components: [] },
			{ ...f.record, builds: [] }
		])
			expect(recordLineage(child.record, { ...source, find: () => origin }).join(' ')).toMatch(
				/owner|original|build/i
			);
		expect(recordLineage(child.record, { ...source, find: () => undefined }).join(' ')).toMatch(
			/clip.*available/i
		);
		expect(
			recordLineage(child.record, { ...source, problems: () => ['corrupt original'] }).join(' ')
		).toContain('corrupt original');
		const changed = globalThis.structuredClone(child.record);
		changed.scenarios[0].states[0].captures[0].server!.buildId = 'd'.repeat(64);
		expect(recordLineage(changed, source).join(' ')).toMatch(/differ|original/i);
		const cyclic = globalThis.structuredClone(f.record);
		cyclic.scenarios[0].states[0].captures[0].videoReference = {
			batch: f.pointers[0].batch,
			record: cyclic.id,
			revision: cyclic.source.commit
		};
		expect(recordLineage(cyclic, { find: () => cyclic, problems: () => [] }).join(' ')).toMatch(
			/cycle/i
		);
	});
}, 30_000);
