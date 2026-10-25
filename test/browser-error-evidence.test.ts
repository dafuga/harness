import { appendFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { CheckRunService } from '../src/services/check-run-service/CheckRunService';
import { verificationRecordSchema } from '../src/core/verificationTypes';
import { recordView } from '../src/utils/recordView';
import { verificationSample } from './support/verificationSample';

const caseOutcome = {
	file: 'orders.spec.ts',
	title: 'Orders > recovers from a failed request',
	revision: verificationSample().source.commit,
	status: 'passed',
	retry: 0
};

const diagnostics = {
	test: 'Orders › recovers from a failed request',
	file: 'orders.spec.ts',
	project: 'chromium',
	retry: 0,
	browser: 'chromium',
	errors: [{ type: 'console', message: 'Orders unavailable', page: 'http://fixture.test/orders' }],
	expected: [{ type: 'console', message: 'Orders unavailable', reason: 'Tests the retry state.' }]
};

for (const exitCode of [0, 1]) {
	test(`verification retains browser diagnostics when the runner exits ${exitCode}`, async () => {
		const root = await mkdtemp(join(tmpdir(), 'harness-browser-evidence-'));
		try {
			await writeDiagnostics(root, exitCode);
			const sample = verificationSample();
			const runner = new CheckRunService({
				snapshot: root,
				directory: root,
				commit: sample.source.commit,
				tree: sample.source.tree,
				profile: sample.profile.id,
				env: process.env
			});
			const outcome = await runner.run({
				id: 'orders:browser',
				scenario: 'orders',
				name: 'browser',
				kind: 'e2e',
				runner: 'playwright',
				target: 'orders.spec.ts',
				cwd: '.',
				command: `'${process.execPath.replaceAll("'", "'\\''")}' writer.cjs`,
				timeoutMs: 10_000
			});
			expect(outcome.passed).toBe(exitCode === 0);
			expect(outcome.entry).toMatchObject({
				browserErrors: [diagnostics],
				cases: {
					outcomes: [caseOutcome],
					artifact: { bytes: expect.any(Number), sha256: expect.stringMatching(/^[a-f0-9]{64}$/) }
				}
			});
			const record = verificationRecordSchema.parse({ ...sample, tests: [outcome.entry] });
			const view = recordView(record, {
				valid: true,
				problems: [],
				resolve: () => ({ media: null })
			});
			expect(view.tests[0]).toMatchObject({ browserErrors: [diagnostics] });
			const inherited = recordView(
				{
					...sample,
					scenarios: [
						{
							id: 'orders',
							status: 'referenced',
							testedRevision: sample.source.commit,
							referencedRecord: 'origin',
							states: []
						}
					]
				},
				{ valid: true, problems: [], resolve: () => ({ media: null }), origins: () => record.tests }
			);
			expect(inherited.scenarios[0].originTests?.[0]).toMatchObject({
				browserErrors: [diagnostics]
			});
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
}

async function writeDiagnostics(root: string, exitCode: number) {
	const writer = `const fs = require('node:fs');
const path = require('node:path');
const directory = process.env.HARNESS_EVIDENCE_DIR;
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory, 'case-results.ndjson'), ${JSON.stringify(JSON.stringify(caseOutcome) + '\n')});
fs.writeFileSync(path.join(directory, 'browser-errors.ndjson'), ${JSON.stringify(JSON.stringify(diagnostics) + '\n')});
process.exitCode = ${exitCode};`;
	await writeFile(join(root, 'writer.cjs'), writer);
}

for (const mode of ['malformed', 'timeout']) {
	test(`verification refuses ${mode} diagnostics even after a runner wrote them`, async () => {
		const root = await mkdtemp(join(tmpdir(), 'harness-refused-diagnostics-'));
		try {
			await writeDiagnostics(root, 0);
			await appendFile(
				join(root, 'writer.cjs'),
				mode === 'timeout'
					? '\nsetInterval(() => {}, 1000);'
					: "\nfs.appendFileSync(path.join(directory, 'browser-errors.ndjson'), 'not-json\\n');"
			);
			const outcome = await runDiagnosticCheck(root, mode === 'timeout' ? 1500 : 10_000);
			expect(outcome.passed).toBe(false);
			expect(outcome.entry.status).toBe('failed');
			expect(outcome.entry.browserErrors).toBeUndefined();
			if (mode === 'timeout') expect(outcome.entry).not.toHaveProperty('cases');
			expect(outcome.failures.join(' ')).toMatch(
				mode === 'timeout' ? /timed out/ : /Browser diagnostics/
			);
			const file = join(
				root,
				'evidence',
				verificationSample().source.commit,
				'orders/browser/browser-errors.ndjson'
			);
			expect(await readFile(file, 'utf8')).toContain('Orders unavailable');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
}

async function runDiagnosticCheck(root: string, timeoutMs: number) {
	const sample = verificationSample();
	return new CheckRunService({
		snapshot: root,
		directory: root,
		commit: sample.source.commit,
		tree: sample.source.tree,
		profile: sample.profile.id,
		env: process.env
	}).run({
		id: 'orders:browser',
		scenario: 'orders',
		name: 'browser',
		kind: 'e2e',
		runner: 'playwright',
		target: 'orders.spec.ts',
		cwd: '.',
		command: `'${process.execPath.replaceAll("'", "'\\''")}' writer.cjs`,
		timeoutMs
	});
}
