import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, type Dirent } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { ownEnvironment } from './cli';
import { freePort } from './workers';

const reports = resolve(import.meta.dirname, '../../packages/reports');
const ports = [
	'PROJECT_REPORTS_E2E_PORT',
	'PROJECT_REPORTS_E2E_R2_PORT',
	'HARNESS_CONSOLE_E2E_LOCKED_PORT',
	'HARNESS_CONSOLE_E2E_EXPOSED_PORT',
	'HARNESS_CONSOLE_E2E_SCALE_PORT'
];

export interface BrowserRun {
	/** Resolves with the exit code once the run and its teardown have finished. */
	finished: Promise<number>;
	/** What the run reported about its own tests; readable once it has finished. */
	results(): { expected: number; unexpected: number; files: string[] };
	output(): string;
	/** Ends a run that is still going, with the servers it started; harmless once it finished. */
	stop(): Promise<void>;
}

export interface SeededHistory {
	/** Top-level directory under the scratch directory that holds this history. */
	home: string;
	file: string;
	commits: Record<string, string>;
}

/**
 * Starts the reports browser suite on a few specs as an independent run: its own free ports, the
 * compiled server a verification uses, and its results kept apart. Where the run keeps its
 * fixtures is not said to it: it only has `scratch` as the temporary directory of its processes.
 */
export async function browserRun(
	name: string,
	scratch: string,
	specs: string[]
): Promise<BrowserRun> {
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
		HARNESS_VERIFY: '1',
		PLAYWRIGHT_JSON_OUTPUT_FILE: results
	};
	const args = ['x', 'playwright', 'test', ...specs, '--reporter=json'];
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
		results() {
			const report = JSON.parse(readFileSync(results, 'utf8')) as {
				stats: { expected: number; unexpected: number };
				suites: Array<{ file: string }>;
			};
			const { expected, unexpected } = report.stats;
			return { expected, unexpected, files: report.suites.map((suite) => suite.file).sort() };
		}
	};
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
		let meta: { commits?: Record<string, string> } = {};
		try {
			meta = JSON.parse(readFileSync(file, 'utf8')) as typeof meta;
		} catch {
			return [];
		}
		const [top] = relative(scratch, file).split(sep);
		return meta.commits?.baseline
			? [{ home: join(scratch, top), file, commits: meta.commits }]
			: [];
	});
}

/** Polls until `ready` returns a value, or fails after the given time with what `ready` meant. */
export async function eventually<Found>(
	ready: () => Found | undefined,
	wanted: string,
	seconds = 180
): Promise<Found> {
	for (let attempt = 0; attempt < seconds * 2; attempt += 1) {
		const found = ready();
		if (found !== undefined) return found;
		await new Promise((done) => setTimeout(done, 500));
	}
	throw new Error(`Timed out after ${seconds} s waiting for ${wanted}.`);
}
