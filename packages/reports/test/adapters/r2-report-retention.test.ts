import { expect, test, vi } from 'vitest';
import type { S3Client } from '@aws-sdk/client-s3';
import { R2ReportRetentionAdapter } from '../../src/adapters/R2ReportRetentionAdapter';
const config = {
	accountId: 'fixture',
	bucket: 'reports-only',
	accessKeyId: 'fixture',
	secretAccessKey: 'fixture'
};
test('cleanup gathers every page before batch deletion and restricts keys to an exact run prefix', async () => {
	const prefix = 'report-evidence/runs/old/';
	const keys = Array.from({ length: 1002 }, (_, i) => prefix + i);
	const send = vi
		.fn()
		.mockResolvedValueOnce({
			Contents: keys.slice(0, 1000).map((Key) => ({ Key })),
			IsTruncated: true,
			NextContinuationToken: 'second'
		})
		.mockResolvedValueOnce({ Contents: keys.slice(1000).map((Key) => ({ Key })) })
		.mockResolvedValue({});
	const store = new R2ReportRetentionAdapter(config, { send } as unknown as S3Client);
	expect(await store.purge('old')).toBe(1002);
	expect(send.mock.calls[1][0].input.ContinuationToken).toBe('second');
	expect(send.mock.calls[2][0].input.Delete.Objects).toHaveLength(1000);
	expect(send.mock.calls[3][0].input.Delete.Objects).toHaveLength(2);
	await expect(store.purge('../other')).rejects.toThrow();
});
test('out-of-scope listings fail before any delete', async () => {
	const send = vi.fn().mockResolvedValue({ Contents: [{ Key: 'unrelated/private' }] });
	await expect(
		new R2ReportRetentionAdapter(config, { send } as unknown as S3Client).purge('old')
	).rejects.toThrow('scope');
	expect(send).toHaveBeenCalledTimes(1);
});
test('orphan cleanup preserves known reports and new orphan objects', async () => {
	const send = vi
		.fn()
		.mockResolvedValueOnce({
			Contents: [
				{ Key: 'report-evidence/runs/orphan/old.wav', LastModified: new Date('2000-01-01') },
				{ Key: 'report-evidence/runs/known/old.wav', LastModified: new Date('2000-01-01') },
				{ Key: 'report-evidence/runs/orphan/new.wav', LastModified: new Date() }
			]
		})
		.mockResolvedValue({});
	expect(
		await new R2ReportRetentionAdapter(config, { send } as unknown as S3Client).orphans(
			new Set(['known']),
			Date.now() - 30 * 86400000
		)
	).toBe(1);
	expect(send.mock.calls[1][0].input.Delete.Objects).toEqual([
		{ Key: 'report-evidence/runs/orphan/old.wav' }
	]);
});
