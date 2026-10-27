import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { CaseResultAdapter } from '../../../src/adapters/verification-evidence/CaseResultAdapter';
import type { RunnerTask } from '../../../src/adapters/verification-evidence/CaseResultAdapter.types';
import { measureWorkload } from '../../support/measureWorkload';

const revision = 'c'.repeat(40);
function fixture() {
	const root = mkdtempSync(join(tmpdir(), 'harness-case-results-'));
	const directory = join(root, 'evidence');
	const file = join(root, 'test/sample.test.ts');
	const alias = join(root, 'source-link');
	mkdirSync(join(root, 'test'));
	writeFileSync(file, '');
	symlinkSync(root, alias, 'dir');
	return { root, directory, revision, file, alias };
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

function assertAliasedFinished(config: ReturnType<typeof fixture>, tasks: RunnerTask[]): void {
	const aliasDirectory = join(config.root, 'alias-evidence');
	const aliased = new CaseResultAdapter({
		...config,
		root: config.alias,
		directory: aliasDirectory
	});
	aliased.onFinished([{ type: 'suite', name: 'file', filepath: config.file, tasks }]);
	expect(
		existsSync(join(aliasDirectory, 'case-results.ndjson')),
		'Case outcomes must retain the identity of a symlinked snapshot root'
	).toBe(true);
	expect(read(aliasDirectory)).toEqual(expectedFinished);
	const outside = mkdtempSync(join(tmpdir(), 'harness-case-outside-'));
	try {
		const file = join(outside, 'outside.test.ts');
		writeFileSync(file, '');
		symlinkSync(file, join(config.root, 'test/outside-link.test.ts'));
		aliased.onFinished([
			{
				type: 'suite',
				name: 'outside',
				filepath: join(config.alias, 'test/outside-link.test.ts'),
				tasks
			}
		]);
		expect(
			read(aliasDirectory),
			'A symlink to a foreign test is not part of the snapshot'
		).toHaveLength(5);
	} finally {
		rmSync(outside, { recursive: true, force: true });
	}
}

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
		assertAliasedFinished(config, tasks);
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

test('CaseResultAdapter.onTestEnd configured retains browser status and suite identity', async () => {
	const config = fixture();
	try {
		const adapter = new CaseResultAdapter(config);
		const sample = {
			location: { file: config.file },
			titlePath: () => ['', 'chromium', 'sample.test.ts', 'orders', 'ready']
		};
		await measureWorkload(
			'adapter.verification-evidence-case-result',
			'record-nested-browser-case',
			() => adapter.onTestEnd(sample, { status: 'passed', retry: 0 })
		);
		for (const status of ['failed', 'timedOut', 'interrupted', 'skipped'])
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
		const aliasDirectory = join(config.root, 'alias-evidence');
		new CaseResultAdapter({ ...config, root: config.alias, directory: aliasDirectory }).onTestEnd(
			sample,
			{ status: 'passed', retry: 0 }
		);
		expect(
			existsSync(join(aliasDirectory, 'case-results.ndjson')),
			'Browser case outcomes must retain a symlinked snapshot root'
		).toBe(true);
		expect(read(aliasDirectory)).toEqual([read(config.directory)[0]]);
		expect(() => adapter.onTestEnd(sample, { status: 'passed', retry: -1 })).toThrow();
		expect(read(config.directory)).toHaveLength(5);
		adapter.onTestEnd(
			{ location: { file: config.file }, titlePath: () => ['', '', 'sample.test.ts', 'ready'] },
			{ status: 'passed', retry: 1 }
		);
		const first = read(config.directory)[0];
		expect(read(config.directory)[5]).toEqual({ ...first, title: 'ready', retry: 1 });
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
