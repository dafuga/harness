import { expect, test } from '@playwright/test';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { ReportRepository } from '../../src/repositories/ReportRepository';
import { replayVideoKey } from '../../src/utils/replayVideo';
test('MP4 download uploads the same playable bytes, supports seeking, and recovers after local eviction', async ({
	request
}) => {
	const root = '/tmp/project-reports-e2e';
	const id = (await readFile(join(root, 'fixture-id'), 'utf8')).trim();
	const report = await new ReportRepository(root).get(id);
	const file = replayVideoKey(report) + '.mp4';
	const url = '/api/replay-video?run=' + id;
	const response = await request.get(url);
	expect(response.status()).toBe(200);
	expect(response.headers()['content-type']).toBe('video/mp4');
	const bytes = await response.body();
	expect(bytes.subarray(4, 8).toString()).toBe('ftyp');
	const port = process.env.PROJECT_REPORTS_E2E_R2_PORT || '5590';
	const cloud = await request.get(
		`http://127.0.0.1:${port}/project-reports-test/report-evidence/runs/${id}/replays/${file}`
	);
	expect(cloud.status()).toBe(200);
	expect(await cloud.body()).toEqual(bytes);
	const range = await request.get(url, { headers: { Range: 'bytes=16-31' } });
	expect(range.status()).toBe(206);
	expect(await range.body()).toEqual(bytes.subarray(16, 32));
	await rm(join(root, 'runs', id, 'replays', file));
	expect(await (await request.get(url)).body()).toEqual(bytes);
});
