import { appendFile, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'vitest';
import { CheckRunService } from '../../src/services/check-run-service/CheckRunService';
import { verificationRecordSchema } from '../../src/core/verificationTypes';
import { recordView } from '../../src/utils/recordView';
import { verificationSample } from './verificationSample';
import type {
	CheckInput,
	DiagnosticsExit,
	RefusedDiagnostics,
	ToolCheck
} from './checkRunCases.types';

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

/** Every writer also prints the resource budget its isolated child inherited. */
function writerScript(exitCode: number): string {
	return `const fs = require('node:fs');
const path = require('node:path');
const directory = process.env.HARNESS_EVIDENCE_DIR;
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory, 'case-results.ndjson'), ${JSON.stringify(JSON.stringify(caseOutcome) + '\n')});
fs.writeFileSync(path.join(directory, 'browser-errors.ndjson'), ${JSON.stringify(JSON.stringify(diagnostics) + '\n')});
process.stdout.write('HARNESS_RESOURCE_MEMORY_MIB=' + process.env.HARNESS_RESOURCE_MEMORY_MIB + String.fromCharCode(10));
process.stdout.write('HARNESS_RESOURCE_CPUS=' + process.env.HARNESS_RESOURCE_CPUS + String.fromCharCode(10));
process.stdout.write('HARNESS_FIXTURE_VALUE=' + process.env.HARNESS_FIXTURE_VALUE + String.fromCharCode(10));
process.exitCode = ${exitCode};`;
}

function refusal(mode: RefusedDiagnostics): string {
	if (mode === 'timeout') return '\nsetInterval(() => {}, 1000);';
	return "\nfs.appendFileSync(path.join(directory, 'browser-errors.ndjson'), 'not-json\\n');fs.appendFileSync(path.join(directory, 'case-results.ndjson'), 'not-json\\n');";
}

function runnerFor(
	root: string,
	env: Record<string, string | undefined> = process.env
): CheckRunService {
	const sample = verificationSample();
	return new CheckRunService({
		snapshot: root,
		directory: root,
		commit: sample.source.commit,
		tree: sample.source.tree,
		profile: sample.profile.id,
		env
	});
}

function runnerCheck(timeoutMs: number): CheckInput {
	return {
		id: 'orders:browser',
		scenario: 'orders',
		name: 'browser',
		kind: 'e2e',
		runner: 'playwright',
		target: 'orders.spec.ts',
		cwd: '.',
		command: `'${process.execPath.replaceAll("'", "'\\''")}' writer.cjs`,
		timeoutMs
	};
}

function tool(id: string, command: string): ToolCheck {
	return { id, command };
}

/** A passing runner retains its browser diagnostics and projects them into evidence records. */
export async function browserDiagnostics(exitCode: DiagnosticsExit): Promise<void> {
	const root = await mkdtemp(join(tmpdir(), 'harness-browser-evidence-'));
	try {
		await writeFile(join(root, 'writer.cjs'), writerScript(exitCode));
		const sample = verificationSample();
		const outcome = await runnerFor(root).run(runnerCheck(10_000));
		expect(
			outcome.passed,
			JSON.stringify({
				failures: outcome.failures,
				log: await readFile(join(root, outcome.entry.log.path), 'utf8')
			})
		).toBe(exitCode === 0);
		expect(outcome.entry.status).toBe(exitCode === 0 ? 'passed' : 'failed');
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
		expect(view.tests[0]).toMatchObject({
			browserErrors: [diagnostics],
			cases: outcome.entry.cases
		});
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
}

/** Malformed or timed-out diagnostics are refused even after the runner wrote them. */
export async function refusedDiagnostics(mode: RefusedDiagnostics): Promise<void> {
	const root = await mkdtemp(join(tmpdir(), 'harness-refused-diagnostics-'));
	try {
		await writeFile(join(root, 'writer.cjs'), writerScript(0));
		await appendFile(join(root, 'writer.cjs'), refusal(mode));
		const outcome = await runnerFor(root).run(runnerCheck(mode === 'timeout' ? 1500 : 10_000));
		expect(outcome.passed).toBe(false);
		expect(outcome.entry.status).toBe('failed');
		expect(outcome.entry.browserErrors).toBeUndefined();
		expect(outcome.entry).not.toHaveProperty('cases');
		if (mode === 'malformed') expect(outcome.failures.join(' ')).toContain('Invalid case results');
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
}

/** An unknown priority is refused before any child process starts. */
export async function invalidPriority(): Promise<void> {
	const root = await mkdtemp(join(tmpdir(), 'harness-invalid-priority-'));
	try {
		const env = { ...process.env, HARNESS_RESOURCE_PRIORITY: 'urgent' };
		await expect(runnerFor(root, env).run(runnerCheck(10_000))).rejects.toThrow(Error);
		await expect(runnerFor(root).run(null as never)).rejects.toThrow(TypeError);
		expect(await readdir(root)).toEqual([]);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

/** The child inherits the parent's supplied reservation, or the 2 GiB standalone default. */
export async function inheritedBudget(): Promise<void> {
	const root = await mkdtemp(join(tmpdir(), 'harness-resource-budget-'));
	try {
		await writeFile(join(root, 'writer.cjs'), writerScript(0));
		let reads = 0;
		const env = { ...process.env };
		Object.defineProperty(env, 'HARNESS_FIXTURE_VALUE', {
			enumerable: true,
			get: () => (++reads === 1 ? 'first' : 'later')
		});
		const outcome = await runnerFor(root, env).run(runnerCheck(10_000));
		expect(outcome.passed).toBe(true);
		const log = await readFile(join(root, outcome.entry.log.path), 'utf8');
		expect(log.split('\n')).toContain('HARNESS_FIXTURE_VALUE=first');
		expect(reads, 'application getters must be read once for the child environment').toBe(1);
		const inherited = process.env.HARNESS_RESOURCE_MEMORY_MIB ?? '2048';
		expect(log.split('\n'), 'check children must inherit the parent memory reservation').toContain(
			`HARNESS_RESOURCE_MEMORY_MIB=${inherited}`
		);
		expect(log.split('\n'), 'check children must inherit the parent CPU reservation').toContain(
			`HARNESS_RESOURCE_CPUS=${process.env.HARNESS_RESOURCE_CPUS ?? '1'}`
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

/** Real disposable tools: first nonempty stdout line, empty stdout, nonzero exit, missing tool. */
export async function versionInitialized(): Promise<void> {
	const root = await mkdtemp(join(tmpdir(), 'harness-version-'));
	try {
		const service = runnerFor(root);
		await expect(service.version(null as never)).rejects.toThrow(TypeError);
		const firstLine = "printf '\\n   \\n  harness 2.4.1  \\nsecond line\\n'";
		await expect(service.version(tool('first-line', firstLine))).resolves.toBe('harness 2.4.1');
		expect(await readFile(join(root, 'logs', 'tool-first-line.log'), 'utf8')).toContain(
			'second line'
		);
		await expect(service.version(tool('empty', 'true'))).resolves.toBeUndefined();
		await expect(service.version(tool('nonzero', 'echo 9.9.9; exit 3'))).resolves.toBeUndefined();
		await expect(
			service.version(tool('missing', 'harness-missing-tool-for-version --version'))
		).resolves.toBeUndefined();
		expect(await readFile(join(root, 'logs', 'tool-missing.log'), 'utf8')).toContain(
			'harness-missing-tool-for-version'
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}
