import type { BrowserRun, Ended, SeededHistory } from './browserRun.types';
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, type Dirent } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { ownEnvironment } from './cli';
import { runFailures, type RunReport } from './runFailures';
import { teardownGate } from './runGate';
import { freePort } from './workers';

const runControls = ['--reporter=json', '--max-failures=1'];
const reports = resolve(import.meta.dirname, '../../packages/reports');
const ports = [
	'PROJECT_REPORTS_E2E_PORT',
	'PROJECT_REPORTS_E2E_R2_PORT',
	'HARNESS_CONSOLE_E2E_LOCKED_PORT',
	'HARNESS_CONSOLE_E2E_EXPOSED_PORT',
	'HARNESS_CONSOLE_E2E_SCALE_PORT'
];

/** What a run wrote into its report file; readable once it has finished. */
function reported(file: string): Pick<BrowserRun, 'results' | 'failures'> {
	return {
		results() {
			const report = JSON.parse(readFileSync(file, 'utf8')) as {
				stats: { expected: number; unexpected: number };
				suites: Array<{ file: string }>;
			};
			const { expected, unexpected } = report.stats;
			return { expected, unexpected, files: report.suites.map((suite) => suite.file).sort() };
		},
		failures() {
			try {
				return runFailures(JSON.parse(readFileSync(file, 'utf8')) as RunReport);
			} catch {
				return [];
			}
		}
	};
}

/**
 * Starts the reports browser suite on a few specs as an independent run: its own free ports, the
 * compiled server a verification uses, and its results kept apart. Where the run keeps its
 * fixtures is not said to it: it only has `scratch` as the temporary directory of its processes.
 * With `repeat` every test runs that many times, which keeps the run and its servers going. With
 * `gate` its teardown keeps its fixtures until the observer holding that gate lets them go.
 */
export async function browserRun(
	name: string,
	scratch: string,
	specs: string[],
	lasting: number | { repeat: number; gate?: string } = 1
): Promise<BrowserRun> {
	const { repeat, gate } =
		typeof lasting === 'number' ? { repeat: lasting, gate: undefined } : lasting;
	const assigned: Record<string, string> = {};
	for (const port of ports) assigned[port] = String(await freePort());
	const results = join(scratch, `${name}-results.json`);
	const env = {
		...ownEnvironment(),
		...assigned,
		TMPDIR: scratch,
		// An independent run: it is given no directory, whatever the caller of this test has.
		HARNESS_E2E_ROOT: undefined,
		HARNESS_E2E_OWNER: undefined,
		HARNESS_CONSOLE_E2E_HOME: undefined,
		HARNESS_ANALYTICS_HOME: undefined,
		HARNESS_VERIFY: '1',
		PLAYWRIGHT_JSON_OUTPUT_FILE: results,
		[teardownGate]: gate
	};
	const args = ['x', 'playwright', 'test', ...specs, ...runControls, `--repeat-each=${repeat}`];
	const child = spawn('bun', [...args, '--output', join(scratch, `${name}-output`)], {
		cwd: reports,
		env,
		detached: true,
		stdio: 'pipe'
	});
	const chunks: Buffer[] = [];
	child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
	child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));
	const finished = new Promise<number>((done) => child.once('exit', (code) => done(code ?? 1)));
	return {
		url: `http://127.0.0.1:${assigned.PROJECT_REPORTS_E2E_PORT}`,
		finished,
		output: () => Buffer.concat(chunks).toString('utf8'),
		async stop() {
			if (child.exitCode !== null || !child.pid) return;
			// An interrupt lets the runner end its own servers and remove its fixtures, as it does
			// when a person stops it. Whatever is left of its group after that is killed.
			process.kill(-child.pid, 'SIGINT');
			const ended = await Promise.race([
				finished.then(() => true),
				new Promise<boolean>((done) => setTimeout(() => done(false), 20_000))
			]);
			if (!ended) process.kill(-child.pid, 'SIGKILL');
			await finished;
		},
		...reported(results)
	};
}

/**
 * Waits for a run to end. One that failed says which of its tests failed and what each raised
 * first, before the end of its output: the output of such a run leaves the errors out.
 */
export async function runPassed(run: Ended, name: string): Promise<void> {
	const code = await run.finished;
	if (code === 0) return;
	const failures = run.failures();
	const told = failures.length > 0 ? failures.join('\n\n') : 'It reported no failed test.';
	const ending = `Its output ended with:\n${run.output().slice(-2000)}`;
	throw new Error(`The ${name} run exited ${code}.\n${told}\n\n${ending}`);
}

/** Resolves once the application server at `url` answers; fails when it never does. */
export async function serving(url: string, seconds = 300): Promise<void> {
	for (let attempt = 0; attempt < seconds * 2; attempt += 1) {
		const ready = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(2_000) }).then(
			(answer) => answer.ok,
			() => false
		);
		if (ready) return;
		await new Promise((done) => setTimeout(done, 500));
	}
	throw new Error(`Nothing answered at ${url} within ${seconds} s.`);
}

/** Files named `meta.json` a few levels below a directory; whatever vanishes meanwhile is skipped. */
function metadataFiles(directory: string, depth = 3): string[] {
	let entries: Dirent[] = [];
	try {
		entries = readdirSync(directory, { withFileTypes: true });
	} catch {
		return [];
	}
	return entries.flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return depth > 0 ? metadataFiles(path, depth - 1) : [];
		return entry.name === 'meta.json' ? [path] : [];
	});
}

/** Every seeded console history found below `scratch`, wherever a run chose to keep it. */
export function seededHistories(scratch: string): SeededHistory[] {
	return metadataFiles(scratch).flatMap((file) => {
		let meta: {
			commits?: Record<string, string>;
			keptBranch?: string;
			explorerUnits?: { page?: string };
		} = {};
		try {
			meta = JSON.parse(readFileSync(file, 'utf8')) as typeof meta;
		} catch {
			return [];
		}
		const [top] = relative(scratch, file).split(sep);
		const [branch, page] = [meta.keptBranch ?? '', meta.explorerUnits?.page ?? ''];
		return meta.commits?.baseline
			? [{ home: join(scratch, top), file, commits: meta.commits, branch, page }]
			: [];
	});
}

/** Polls until `ready` returns a value, or fails after the given time with what `ready` meant. */
export async function eventually<Found>(
	ready: () => Found | undefined | Promise<Found | undefined>,
	wanted: string,
	seconds = 180
): Promise<Found> {
	for (let attempt = 0; attempt < seconds * 2; attempt += 1) {
		const found = await ready();
		if (found !== undefined) return found;
		await new Promise((done) => setTimeout(done, 500));
	}
	throw new Error(`Timed out after ${seconds} s waiting for ${wanted}.`);
}

export const concurrentBrowserRunRepetitions = 1;

export async function beforeDeadline<Value>(
	promise: Promise<Value>,
	milliseconds: number
): Promise<Value | undefined> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	return Promise.race([
		promise,
		new Promise<undefined>((resolve) => {
			timer = setTimeout(() => resolve(undefined), milliseconds);
		})
	]).finally(() => {
		if (timer) clearTimeout(timer);
	});
}

export type { BrowserRun, SeededHistory } from './browserRun.types';
