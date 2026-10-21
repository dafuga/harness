import { expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isolatedProfileCapture } from '../../../test/support/taskProfiles';
import { benchmarkCaptureSchema } from '../../../src/core/verifyTypes';
import { startRelay } from './support/relayFixture';

test('a real Worker operation retains its result once, measures its own heap and rejects failed samples', async () => {
	await isolatedProfileCapture(async (directory) => {
		const relay = await startRelay();
		try {
			let calls = 0;
			let response: Response | undefined;
			const input = {
				units: ['relay.entry.index', 'relay.controller.public-relay'],
				workload: 'local-health-request'
			};
			const actual = await relay.profile(input, async () => {
				calls++;
				response = await relay.fetch('/v1/health');
				return response;
			});
			expect(actual).toBe(response);
			expect(actual.status).toBe(200);
			expect(await actual.json()).toMatchObject({ ok: true });
			expect(calls).toBe(1);
			const error = new Error('actual operation failed');
			await expect(
				relay.profile(input, async () => {
					calls++;
					throw error;
				})
			).rejects.toBe(error);
			expect(calls).toBe(2);
			const lines = (await readFile(join(directory, 'captures.ndjson'), 'utf8')).trim().split('\n');
			expect(lines).toHaveLength(1);
			const capture = JSON.parse(lines[0]);
			const data = benchmarkCaptureSchema.parse(
				JSON.parse(await readFile(join(directory, capture.file), 'utf8'))
			);
			expect(data.measurements).toHaveLength(4);
			for (const unit of input.units) {
				const own = data.measurements.filter((item) => item.unit === unit);
				expect(own.map((item) => item.metric)).toEqual([
					'latency-worker-roundtrip-ms',
					'memory-bytes'
				]);
				expect(
					own.every((item) => item.value! > 0 && item.samples === 1 && item.target === 'module')
				).toBe(true);
				expect(own[1].method).toContain('Whole relay Worker isolate');
			}
		} finally {
			await relay.stop();
		}
	});
});
