import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { CaseResultAdapter } from '../../../src/adapters/verification-evidence/CaseResultAdapter';
import type { RunnerTask } from '../../../src/adapters/verification-evidence/CaseResultAdapter.types';

const revision = 'c'.repeat(40);
function fixture() {
	const root = mkdtempSync(join(tmpdir(), 'harness-case-results-'));
	const directory = join(root, 'evidence');
	return { root, directory, revision, file: join(root, 'test/sample.test.ts') };
}
const read = (directory: string) =>
	readFileSync(join(directory, 'case-results.ndjson'), 'utf8')
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line));

const expectedFinished = [
	{
		file: 'test/sample.test.ts',
		title: 'methods > ready',
		revision,
		retry: 0,
		status: 'failed'
	},
	{
		file: 'test/sample.test.ts',
		title: 'methods > ready',
		revision,
		retry: 1,
		status: 'passed'
	},
	{
		file: 'test/sample.test.ts',
		title: 'methods > refused',
		revision,
		retry: 0,
		status: 'failed'
	},
	{
		file: 'test/sample.test.ts',
		title: 'methods > skipped',
		revision,
		retry: 0,
		status: 'skipped'
	},
	{
		file: 'test/sample.test.ts',
		title: 'methods > pending',
		revision,
		retry: 0,
		status: 'skipped'
	}
];

// Declared matrix: each reporter method with configured and disabled evidence collection.
test('CaseResultAdapter.onFinished configured retains nested results, retries and failures', () => {
	const config = fixture();
	try {
		const adapter = new CaseResultAdapter(config);
		const tasks: RunnerTask[] = [
			{
				type: 'suite',
				name: 'methods',
				tasks: [
					{ type: 'test', name: 'ready', result: { state: 'pass', retryCount: 1 } },
					{ type: 'test', name: 'refused', result: { state: 'fail' } },
					{ type: 'test', name: 'skipped', mode: 'skip' },
					{ type: 'test', name: 'pending', mode: 'todo' }
				]
			}
		];
		adapter.onFinished([{ type: 'suite', name: 'file', filepath: config.file, tasks }]);
		expect(read(config.directory)).toEqual(expectedFinished);
		adapter.onFinished([
			{ type: 'suite', name: 'external', filepath: '/outside/source.test.ts', tasks }
		]);
		expect(read(config.directory)).toHaveLength(5);
		expect(() =>
			new CaseResultAdapter({ ...config, revision: 'invalid' }).onFinished([
				{ type: 'suite', name: 'file', filepath: config.file, tasks }
			])
		).toThrow();
	} finally {
		rmSync(config.root, { recursive: true, force: true });
	}
});

test('CaseResultAdapter.onFinished disabled writes no evidence', () => {
	const config = fixture();
	try {
		new CaseResultAdapter({ ...config, revision: '' }).onFinished([
			{
				type: 'suite',
				name: 'file',
				filepath: config.file,
				tasks: [{ type: 'test', name: 'ready', result: { state: 'pass' } }]
			}
		]);
		expect(existsSync(config.directory)).toBe(false);
	} finally {
		rmSync(config.root, { recursive: true, force: true });
	}
});

test('CaseResultAdapter.onTestEnd configured retains browser status and suite identity', () => {
	const config = fixture();
	try {
		const adapter = new CaseResultAdapter(config);
		const sample = {
			location: { file: config.file },
			titlePath: () => ['chromium', 'sample.test.ts', 'orders', 'ready']
		};
		for (const status of ['passed', 'failed', 'timedOut', 'interrupted', 'skipped'])
			adapter.onTestEnd(sample, { status, retry: 0 });
		expect(read(config.directory)).toEqual(
			['passed', 'failed', 'failed', 'failed', 'skipped'].map((status) => ({
				file: 'test/sample.test.ts',
				title: 'orders > ready',
				revision,
				retry: 0,
				status
			}))
		);
		expect(() => adapter.onTestEnd(sample, { status: 'passed', retry: -1 })).toThrow();
		expect(read(config.directory)).toHaveLength(5);
	} finally {
		rmSync(config.root, { recursive: true, force: true });
	}
});

test('CaseResultAdapter.onTestEnd disabled writes no evidence', () => {
	const config = fixture();
	try {
		new CaseResultAdapter({ ...config, directory: '' }).onTestEnd(
			{
				location: { file: config.file },
				titlePath: () => ['chromium', 'sample.test.ts', 'ready']
			},
			{ status: 'passed', retry: 0 }
		);
		expect(existsSync(config.directory)).toBe(false);
	} finally {
		rmSync(config.root, { recursive: true, force: true });
	}
});
