import { expect, test } from 'vitest';
import { VideoArchiveService } from '../../../src/services/verification-evidence/VideoArchiveService';
import { withTempRepo } from '../../support/temporary';
import {
	videoArchiveFixture,
	videoArchiveBudgetExamples,
	invalidVideoArchiveInputs,
	videoArchiveRemote,
	seedUnrelatedArchiveMedia,
	aliasedVideoBatchPointer
} from '../../support/videoArchiveFixture';
import { EvidenceBranchRepository } from '../../../src/repositories/verification-evidence/evidence-branch-repository/EvidenceBranchRepository';
import { LfsAdapter } from '../../../src/adapters/git-source-history/LfsAdapter';
import { GitAdapter } from '../../../src/adapters/git-source-history/GitAdapter';
import { evidenceRef } from '../../../src/core/git-source-history/historyTypes';
import { sourceArchiveRef } from '../../../src/utils/git-source-history/historyRefs';
import { readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { hash } from '../../support/frameFlagFixture';
import { measureWorkload } from '../../support/measureWorkload';
import { vi } from 'vitest';

test('VideoArchiveService runs', () => {
	expect(new VideoArchiveService().run()).toBe('video-archive');
	expect(typeof new VideoArchiveService().write).toBe('function');
});

test('archive seals original provenance and round-trips LFS without changing source', async () => {
	await withTempRepo(async ({ root, git }) => {
		const input = await videoArchiveFixture(root, git),
			service = new VideoArchiveService(root);
		const tree = git('write-tree');
		const pointers = await measureWorkload(
			'service.verification-evidence-video-archive',
			'write-read-sealed-clip',
			() => service.write([input])
		);
		expect(pointers).toHaveLength(1);
		const pointer = pointers[0],
			read = await new VideoArchiveService(root).read(pointer);
		expect(pointer).toMatchObject({
			schemaVersion: 1,
			kind: 'harness-video-batch',
			evidence: { path: `video-batches/${pointer.batch}` }
		});
		expect(read.batch.clips[0]).toMatchObject({
			original: input.original,
			slot: input.slot,
			video: input.video
		});
		expect(read.batch).not.toHaveProperty('status');
		expect(read.batch).not.toHaveProperty('verdict');
		expect(read.files.get(`media/${input.sha256}.mp4`)).toEqual(input.videoBytes);
		expect(read.files.get(`media/${input.video.poster.sha256}.png`)).toEqual(input.posterBytes);
		expect(await service.write([input])).toEqual(pointers);
		const evidence = new EvidenceBranchRepository(root);
		expect(
			(await evidence.tree.read(
				pointer.evidence.commit,
				`${pointer.evidence.path}/media/${input.sha256}.mp4`
			))!.toString()
		).toContain('oid sha256:');
		expect(git('rev-parse', sourceArchiveRef(input.original.revision))).toBe(
			input.original.revision
		);
		expect(git('rev-parse', 'HEAD')).toBe(input.original.revision);
		expect(git('write-tree')).toBe(tree);
		expect(git('status', '--porcelain')).toBe('');
	});
});

test('archive partitions at 64 clips and 512 MiB of unique media without relabeling', async () => {
	await withTempRepo(async ({ root, git }) => {
		const input = await videoArchiveFixture(root, git),
			service = new VideoArchiveService(root);
		const inputs = Array.from({ length: 65 }, (_, i) => ({
			...input,
			slot: { ...input.slot, viewport: `view-${i}` }
		}));
		const pointers = await service.write(inputs);
		expect(pointers).toHaveLength(2);
		expect((await service.read(pointers[0])).batch.clips).toHaveLength(64);
		expect((await service.read(pointers[1])).batch.clips).toHaveLength(1);
		const { splitVideoBatches } =
			await import('../../../src/services/verification-evidence/video-archive-service/batch');
		const clip = (await service.read(pointers[0])).batch.clips[0];
		const clips = videoArchiveBudgetExamples(clip);
		expect(splitVideoBatches(clips).map((batch) => batch.length)).toEqual([32, 1]);
		expect(splitVideoBatches(Array.from({ length: 64 }, () => clip))).toHaveLength(1);
	});
});

test('archive rejects malformed, oversized or unbound pairs before evidence publication', async () => {
	await withTempRepo(async ({ root, git }) => {
		const input = await videoArchiveFixture(root, git),
			service = new VideoArchiveService(root);
		git('update-ref', `refs/heads/${'e'.repeat(40)}`, input.original.revision);
		for (const invalid of invalidVideoArchiveInputs(input, input.alternatePoster))
			await expect(service.write([invalid])).rejects.toThrow();
		await expect(
			service.write([
				input,
				{
					...input,
					slot: { ...input.slot, viewport: 'other' },
					original: { ...input.original, tree: '0'.repeat(40) }
				}
			])
		).rejects.toThrow();
		expect(await new EvidenceBranchRepository(root).tip()).toBeUndefined();
	});
});

test('archive pins ancestry and refuses broken seals, absent media and corrupt objects', async () => {
	await withTempRepo(async ({ root, git }) => {
		const input = await videoArchiveFixture(root, git),
			service = new VideoArchiveService(root);
		const [pointer] = await service.write([input]),
			evidence = new EvidenceBranchRepository(root);
		await expect(service.read(aliasedVideoBatchPointer(pointer, git))).rejects.toThrow();
		await expect(service.read(pointer, input.original.revision)).rejects.toThrow(
			/ancestry|evidence/i
		);
		await expect(service.read({ ...pointer, batch: '0'.repeat(64) })).rejects.toThrow();
		const altered = await evidence.tree.commit({
			parents: [pointer.evidence.commit],
			message: 'bad fixture',
			files: [{ path: `${pointer.evidence.path}/batch.json`, content: { bytes: '{}' } }]
		});
		await evidence.tree.advance(evidenceRef, altered, pointer.evidence.commit);
		await expect(
			service.read({ ...pointer, evidence: { ...pointer.evidence, commit: altered } })
		).rejects.toThrow();
		expect((await service.read(pointer, altered)).batch.clips[0].original).toEqual(input.original);
		const path = await new LfsAdapter(root).path(input.sha256);
		await rm(path);
		await expect(service.read(pointer, altered)).rejects.toThrow(/missing|integrity/i);
		await writeFile(path, Buffer.alloc(input.videoBytes.length));
		await expect(service.read(pointer, altered)).rejects.toThrow(/hash|integrity/i);
	});
});

test('current reuses only exact slots and input hashes and keeps the original revision', async () => {
	await withTempRepo(async ({ root, git }) => {
		const input = await videoArchiveFixture(root, git),
			service = new VideoArchiveService(root);
		const pointers = await service.write([input]);
		git('commit', '--allow-empty', '-qm', 'feat: unrelated current source');
		const reused = await service.current(input.slot, input.video.inputHash, pointers);
		expect(reused!.clip.original.revision).toBe(input.original.revision);
		expect(reused!.pointer).toEqual(pointers[0]);
		expect(await service.current(input.slot, 'd'.repeat(64), pointers)).toBeNull();
		expect(
			await service.current({ ...input.slot, viewport: 'mobile' }, input.video.inputHash, pointers)
		).toBeNull();
		await writeFile(await new LfsAdapter(root).path(input.sha256), 'corrupt');
		expect(await service.current(input.slot, input.video.inputHash, pointers)).toBeNull();
	});
});

test('restore verifies bytes and refuses existing conflicts and symlink destinations', async () => {
	await withTempRepo(async ({ root, git }) => {
		const input = await videoArchiveFixture(root, git),
			service = new VideoArchiveService(root);
		const [pointer] = await service.write([input]),
			target = join(root, '.cache/restored');
		const read = await service.restore(pointer, target);
		await expect(service.restore(pointer, join(root, '..', 'escape'))).rejects.toThrow(/inside/i);
		for (const [path, bytes] of read.files)
			expect(hash(await readFile(join(target, path)))).toBe(hash(bytes));
		await service.restore(pointer, target);
		await writeFile(join(target, `media/${input.sha256}.mp4`), 'conflict');
		await expect(service.restore(pointer, target)).rejects.toThrow(/conflict|different/i);
		await symlink(target, join(root, '.cache/link'));
		await expect(service.restore(pointer, join(root, '.cache/link'))).rejects.toThrow(
			/symlink|directory/i
		);
	});
});

test('archive reads never fetch and explicit fetch verifies the received evidence ancestry', async () => {
	await withTempRepo(async ({ root, git }) => {
		const input = await videoArchiveFixture(root, git),
			service = new VideoArchiveService(root);
		const unrelated = await seedUnrelatedArchiveMedia(root);
		const [pointer] = await service.write([input]),
			remote = await videoArchiveRemote(root, input);
		await withTempRepo(async (client) => {
			client.git('commit', '--allow-empty', '-qm', 'feat: unrelated fresh restore fixture');
			const head = client.git('rev-parse', 'HEAD'),
				consumer = new VideoArchiveService(client.root);
			client.git('remote', 'add', 'archive-fixture', remote);
			client.git('config', 'remote.archive-fixture.fetch', '+refs/*:refs/*');
			const run = vi.spyOn(GitAdapter.prototype, 'run');
			try {
				await expect(consumer.read(pointer)).rejects.toThrow(/ancestry/i);
				expect(run.mock.calls.filter(([args]) => args[0] === 'fetch')).toEqual([]);
				const fetched = await consumer.fetch(pointer, 'archive-fixture');
				expect(fetched.batch.clips[0].original).toEqual(input.original);
				expect(await new LfsAdapter(client.root).read(unrelated)).toBeUndefined();
				const ref = sourceArchiveRef(input.original.revision);

				expect(client.git('rev-parse', ref)).toBe(input.original.revision);
				expect(client.git('rev-parse', 'HEAD')).toBe(head);
				expect(await new EvidenceBranchRepository(client.root).tip()).toBeUndefined();
				const target = join(client.root, '.cache/restore');
				await consumer.restore(pointer, target, pointer.evidence.commit);
				expect(hash(await readFile(join(target, `media/${input.sha256}.mp4`)))).toBe(input.sha256);
				client.git('update-ref', ref, head);
				await expect(consumer.fetch(pointer, 'archive-fixture')).rejects.toThrow(/conflict/i);
				expect(client.git('rev-parse', ref)).toBe(head);
				await expect(consumer.fetch(pointer, remote)).rejects.toThrow(/remote/i);
			} finally {
				run.mockRestore();
			}
		});
	});
});
