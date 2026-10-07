import { afterEach, expect, test, vi } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReportRepository } from '../src/repositories/ReportRepository';
import { AudioUploadService } from '../src/services/AudioUploadService';
import { audioFixture } from './audioFixture';

const { put } = vi.hoisted(() => ({ put: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../src/adapters/R2EvidenceStoreAdapter', () => ({
	R2EvidenceStoreAdapter: { fromEnvironment: () => ({ put }) }
}));
const roots: string[] = [];
async function fixture() {
	const root = await mkdtemp(join(tmpdir(), 'cloudflare-evidence-'));
	roots.push(root);
	const repository = new ReportRepository(root);
	const report = await repository.begin({
		project: '/tmp/audio',
		title: 'Cloud storage',
		mode: 'feature',
		environment: 'fixture'
	});
	return { repository, report };
}
afterEach(async () => {
	vi.clearAllMocks();
	put.mockResolvedValue(undefined);
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test('CLI evidence uses configured Cloudflare storage by default with exact original bytes', async () => {
	const { repository, report } = await fixture();
	const path = join(repository.directory(report.id), 'original.wav');
	await writeFile(path, audioFixture());
	const result = await repository.record(report.id, {
		kind: 'evidence',
		data: { id: 'clip', title: 'Failed command', category: 'Speech', status: 'failed', path }
	});
	expect(put).toHaveBeenCalledWith(report.id, result.evidence[0].file, audioFixture(), 'audio/wav');
	expect(result.evidence[0]).toMatchObject({
		storage: 'r2-evidence',
		status: 'failed',
		durationSeconds: 3
	});
	expect(
		await readFile(join(repository.directory(report.id), 'assets', result.evidence[0].file))
	).toEqual(audioFixture());
});

test('browser audio comparisons upload both originals to Cloudflare before saving', async () => {
	const { repository, report } = await fixture();
	const result = await new AudioUploadService(repository).uploadComparison(report.id, {
		title: 'Pair',
		note: 'Failed recognition',
		source: 'Generated',
		before: new File([audioFixture(3, 220)], 'before.wav'),
		after: new File([audioFixture(3, 440)], 'after.wav')
	});
	expect(put).toHaveBeenCalledTimes(2);
	expect(result.evidence.map((item) => item.storage)).toEqual(['r2-evidence', 'r2-evidence']);
	expect(result.evidence.map((item) => item.phase)).toEqual(['before', 'after']);
});

test('a failed second Cloudflare write preserves the previous manifest exactly', async () => {
	const { repository, report } = await fixture();
	const manifest = join(repository.directory(report.id), 'manifest.json');
	const previous = await readFile(manifest);
	put.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('R2 unavailable'));
	await expect(
		new AudioUploadService(repository).uploadComparison(report.id, {
			title: 'Pair',
			note: '',
			source: 'Generated',
			before: new File([audioFixture(3, 220)], 'before.wav'),
			after: new File([audioFixture(3, 440)], 'after.wav')
		})
	).rejects.toThrow('R2 unavailable');
	expect(await readFile(manifest)).toEqual(previous);
});
