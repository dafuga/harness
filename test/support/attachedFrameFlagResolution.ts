import type { VerificationRecord } from '../../src/core/verification-evidence/verificationTypes';
import { measureWorkload } from './measureWorkload';
import { expect, vi } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { attachedFrameFixture, frameRecordFixture } from './attachedFrameFixture';
import { frameFlagFixture } from './frameFlagFixture';
import { withTempRepo } from './temporary';
import { FrameFlagService } from '../../src/services/verification-evidence/FrameFlagService';
import { EvidenceAttachService } from '../../src/services/verification-evidence/evidence-attach-service/EvidenceAttachService';
import { VerificationCheckService } from '../../src/services/verification-evidence/VerificationCheckService';
import { HistoryNoteRepository } from '../../src/repositories/git-source-history/history-note-repository/HistoryNoteRepository';
import { EvidenceBranchRepository } from '../../src/repositories/verification-evidence/evidence-branch-repository/EvidenceBranchRepository';
import { resolveAttachedVideoFlags } from '../../src/services/verification-evidence/evidence-attach-service/attachedVideoFlags';

/** Real append-only media and notes; source-contract hashing is covered by the attach suite. */
export async function assertAttachedFrameFlagResolution() {
	const integrity = vi.spyOn(VerificationCheckService.prototype, 'integrity').mockResolvedValue([]);
	try {
		for (const standing of ['full', 'scoped', 'failed', 'wrong-owner', 'late', 'old'] as const)
			await withTempRepo((repo) => assertAttachmentCase(repo, standing));
	} finally {
		integrity.mockRestore();
	}
}

async function assertAttachmentCase(
	{ root, git }: Parameters<Parameters<typeof withTempRepo>[0]>[0],
	standing: 'full' | 'scoped' | 'failed' | 'wrong-owner' | 'late' | 'old'
) {
	const rejected = ['late', 'old'].includes(standing);
	const resolves = ['full', 'scoped'].includes(standing);

	const { f, original, flag, flags } = await originalFlagFixture({ root, git });
	const { record, files } = frameRecordFixture({
		root,
		git,
		reference: f.reference,
		video: f.replacement,
		standing: retainedStanding(standing),
		addressedFlags: [flag.id],
		capturedAt:
			standing === 'old' ? '2026-01-01T00:00:00Z' : new Date(Date.now() + 10).toISOString()
	});
	const directory = join(root, '.cache/replacement');
	await mkdir(directory, { recursive: true });
	await writeFile(join(directory, 'record.json'), JSON.stringify(record));
	for (const [file, bytes] of files) await writeFile(join(directory, file), bytes);
	if (standing === 'late')
		await flags.flag({ clip: original, frameNumber: 3, note: 'Late reviewer flag' });
	const attach = new EvidenceAttachService(root);
	const operation = attach.attach(f.reference.revision, { record, directory });
	if (rejected) await expect(operation).rejects.toThrow(/pending|flag|predates|older|before/i);
	else {
		const attached = await operation;
		expect(attached.status).toBe(standing === 'full' ? 'passed' : 'failed');
		const expected = resolves ? 'resolved' : 'active';
		expect((await flags.list(original.unit)).find((item) => item.id === flag.id)?.status).toBe(
			expected
		);
		const tip = await new EvidenceBranchRepository(root).tip();
		await attach.attach(f.reference.revision, { record, directory });
		expect(await new EvidenceBranchRepository(root).tip()).toBe(tip);
		if (standing === 'full') {
			await assertReusedFlagResolution(root, record);
			const late = await flags.flag({
				clip: original,
				frameNumber: 4,
				note: 'Arrived after attachment'
			});
			await expect(attach.attach(f.reference.revision, { record, directory })).rejects.toThrow(
				/pending.*flag|flag.*pending/i
			);
			expect((await flags.list(original.unit)).find((item) => item.id === late.id)?.status).toBe(
				'active'
			);
		}
	}
	expect(await new HistoryNoteRepository(root).text(f.reference.revision)).toContain(record.id);
	await assertFailedAttachmentStanding(flags, original.unit, rejected);
}

/** A new parent preserves old acknowledgements without pretending to resolve them again. */
async function assertReusedFlagResolution(root: string, original: VerificationRecord) {
	const reused = globalThis.structuredClone(original);
	reused.id = 'd'.repeat(64);
	for (const capture of reused.scenarios.flatMap((scenario) =>
		scenario.states.flatMap((state) => state.captures)
	))
		if (capture.kind === 'video')
			capture.videoReference = {
				batch: 'e'.repeat(64),
				record: original.id,
				revision: original.source.commit
			};
	const address = vi.spyOn(FrameFlagService.prototype, 'address');
	try {
		await expect(resolveAttachedVideoFlags(root, reused)).resolves.toBeUndefined();
		expect(address).not.toHaveBeenCalled();
	} finally {
		address.mockRestore();
	}
}

async function assertOldProof(root: string, record: VerificationRecord, pending: boolean) {
	const report = await measureWorkload(
		'service.verification-check',
		'current-video-review-proof',
		() =>
			new VerificationCheckService(root).check(record.source.commit, { record, directory: root })
	);
	expect(report.status).toBe(pending ? 'failed' : 'passed');
	if (pending) expect(report.problems.join(' ')).toMatch(/pending.*flag|flag.*pending/i);
}

async function originalFlagFixture({
	root,
	git
}: Parameters<Parameters<typeof withTempRepo>[0]>[0]) {
	const f = await frameFlagFixture(root, git);
	const original = await attachedFrameFixture({
		root,
		git,
		reference: f.reference,
		video: f.original,
		standing: 'full'
	});
	const prior = frameRecordFixture({
		root,
		git,
		reference: f.reference,
		video: f.original,
		standing: 'full'
	}).record;
	await assertOldProof(root, prior, false);
	const flags = new FrameFlagService(root);
	const flag = await flags.flag({ clip: original, frameNumber: 2 });
	await assertOldProof(root, prior, true);
	expect(await flags.frame(original.unit, flag.id)).toBeInstanceOf(Buffer);
	return { f, original, flag, flags };
}

function retainedStanding(standing: Parameters<typeof assertAttachmentCase>[1]) {
	return standing === 'late' || standing === 'old' ? 'full' : standing;
}

async function assertFailedAttachmentStanding(
	flags: FrameFlagService,
	unit: string,
	rejected: boolean
) {
	if (rejected)
		expect((await flags.list(unit)).every((item) => item.status === 'active')).toBe(true);
}
