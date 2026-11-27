import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import type { CheckResult } from '../scripts/shared-checks/sharedCheck.types';
import { fixture, git, submit } from './shared-checks.fixture';

function executed(result: CheckResult) {
	return result.checks.filter((check) => check.source === 'executed').map((check) => check.id);
}

test('independent check sessions batch one candidate tree, select affected tests and skip all checks on rerun', async () => {
	const inputs = fixture();
	try {
		const first = await Promise.all([
			submit(inputs, inputs.first, 'first1'),
			submit(inputs, inputs.second, 'second2')
		]);
		expect(
			first.map(({ code }) => code),
			JSON.stringify(first)
		).toEqual([0, 0]);
		const combined = first[0].result;
		expect(first[1].result).toEqual({ ...combined, commit: inputs.second });
		expect(git(inputs.repo, 'show', `${combined.tree}:src/utils/values.js`)).toContain(
			'export const bottom = 2'
		);
		expect(combined.batch).toHaveLength(2);
		expect(combined.mode).toBe('focused');
		expect(combined.checks.map(({ id }) => id)).toEqual(
			expect.arrayContaining(['test/affected.test.ts', 'smoke:git'])
		);
		expect(combined.checks.map(({ id }) => id)).not.toContain('test/unrelated.test.ts');
		expect(executed(combined)).toHaveLength(combined.checks.length);
		const again = await Promise.all([
			submit(inputs, inputs.first, 'first1'),
			submit(inputs, inputs.second, 'second2')
		]);
		expect(again.map(({ code }) => code)).toEqual([0, 0]);
		expect(again[0].result.tree).toBe(combined.tree);
		expect(executed(again[0].result)).toEqual([]);
		expect(again[0].result.checks.every(({ source }) => source === 'local-cache')).toBe(true);
		expect(readFileSync(inputs.notes, 'utf8')).toContain(`Tree ${combined.tree}`);
		expect(git(inputs.repo, 'status', '--porcelain')).toBe('');
		expect(
			readdirSync(join(inputs.home, 'checks')).filter((name) => name.startsWith('snapshot-'))
		).toEqual([]);
		const serial = await submit(inputs, inputs.first, undefined, {
			home: join(inputs.folder, 'serial')
		});
		const serialSecond = await submit(inputs, inputs.second, undefined, {
			home: join(inputs.folder, 'serial')
		});
		expect([serial.code, serialSecond.code]).toEqual([0, 0]);
		console.info('Shared queue fixture measurements', {
			combinedMs: Math.max(...first.map(({ wallMs }) => wallMs)),
			cacheMs: Math.max(...again.map(({ wallMs }) => wallMs)),
			serialMs: serial.wallMs + serialSecond.wallMs,
			workerRssMiB: Math.round((combined.workerRssBytes ?? 0) / 1048576),
			executed: executed(combined).length
		});
	} finally {
		rmSync(inputs.folder, { recursive: true, force: true });
	}
}, 120_000);

test('a failed combined test is split and each Tracker item receives the verdict of its own candidate', async () => {
	const inputs = fixture();
	try {
		const [good, bad] = await Promise.all([
			submit(inputs, inputs.first, 'first1'),
			submit(inputs, inputs.failing, 'fail01')
		]);
		expect(good.code, JSON.stringify(good)).toBe(0);
		expect(bad.code).toBe(1);
		expect(good.result.batch).toEqual([inputs.first]);
		expect(bad.result.batch).toEqual([inputs.failing]);
		expect(bad.result.detail).toContain('test/affected.test.ts failed');
		expect(good.result.detail).toContain('Combined batch of 2 failed');
		expect(readFileSync(inputs.notes, 'utf8')).toMatch(/note fail01 Shared check failed/);
		const exact = await submit(inputs, inputs.first, undefined, { exact: true });
		expect(exact.code).toBe(0);
		expect(exact.result.testedCommit).toBe(inputs.first);
		expect(exact.result.tree).toBe(good.result.tree);
		expect(executed(exact.result)).toEqual([]);
	} finally {
		rmSync(inputs.folder, { recursive: true, force: true });
	}
}, 120_000);
