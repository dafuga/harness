import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Environment = Record<string, string | undefined>;

/** Per-run copies of the build, inside the checkout and outside everything tracked. */
const frozenBuilds = fileURLToPath(
	new URL('../../../../../../.cache/reports-e2e/', import.meta.url)
);

/** Where one browser run keeps everything it seeds; no two runs share any of it. */
export interface E2eFixtures {
	root: string;
	/** The report store its servers read and its specs write. */
	reports: string;
	/** The seeded console history, its index and the metadata the specs read. */
	console: string;
	analytics: string;
	/**
	 * The copy of the finished build its servers are started from. It lies in the checkout's
	 * cache, where the packages a built server imports resolve, under the name of the run.
	 */
	build: string;
	/** A checkout of a fixture application, by its directory name. */
	site(name: string): string;
}

/** The servers of a run; each listens on a port of its own unless the caller named one. */
const portNames = [
	'PROJECT_REPORTS_E2E_PORT',
	'PROJECT_REPORTS_E2E_R2_PORT',
	'HARNESS_CONSOLE_E2E_LOCKED_PORT',
	'HARNESS_CONSOLE_E2E_EXPOSED_PORT',
	'HARNESS_CONSOLE_E2E_SCALE_PORT'
];

const missing =
	'This process belongs to no browser run: HARNESS_E2E_ROOT is not set. The Playwright ' +
	'configuration makes one directory per run; a script started by hand must be given one.';

/**
 * The fixtures of the run this process belongs to. The run is named by HARNESS_E2E_ROOT, which
 * the process that started it set for its servers, seeds and specs. There is no shared default:
 * a process outside any run is told so. HARNESS_CONSOLE_E2E_HOME and HARNESS_ANALYTICS_HOME
 * still place those two elsewhere when a caller names them.
 */
export function e2eFixtures(env: Environment = process.env): E2eFixtures {
	const root = env.HARNESS_E2E_ROOT;
	if (!root) throw new Error(missing);
	return {
		root,
		reports: join(root, 'reports'),
		console: env.HARNESS_CONSOLE_E2E_HOME ?? join(root, 'console'),
		analytics: env.HARNESS_ANALYTICS_HOME ?? join(root, 'analytics'),
		build: join(frozenBuilds, basename(root), 'build'),
		site: (name) => join(root, 'sites', name)
	};
}

/** Loopback ports that were free a moment ago, found without waiting on the event loop. */
export function freePorts(count: number): number[] {
	if (count === 0) return [];
	const script =
		"const net=require('node:net');const servers=[];let left=Number(process.argv[1]);" +
		'const done=()=>{console.log(JSON.stringify(servers.map((s)=>s.address().port)));for(const s of servers)s.close()};' +
		"for(let i=0;i<left;i+=1){const s=net.createServer();servers.push(s);s.listen(0,'127.0.0.1',()=>{left-=1;if(left===0)done()})}";
	const printed = execFileSync(process.execPath, ['-e', script, String(count)], {
		encoding: 'utf8'
	});
	return JSON.parse(printed) as number[];
}

/**
 * Opens the run this process starts. Unless the caller named them, the run gets a directory of
 * its own and free ports, and both are written to the environment so that its servers, seeds
 * and specs see the same ones. A process that already belongs to a run changes nothing.
 */
export function openE2eRun(env: Environment = process.env): E2eFixtures {
	if (!env.HARNESS_E2E_ROOT) {
		env.HARNESS_E2E_ROOT = mkdtempSync(join(tmpdir(), 'harness-reports-e2e-'));
		// Only the process that made the directory removes it.
		env.HARNESS_E2E_OWNER = String(process.pid);
	}
	const unnamed = portNames.filter((name) => !env[name]);
	const ports = freePorts(unnamed.length);
	for (const [index, name] of unnamed.entries()) env[name] = String(ports[index]);
	return e2eFixtures(env);
}

/** True when the caller named the directory of the run, so servers it started may be adopted. */
export function namedE2eRun(env: Environment = process.env): boolean {
	return Boolean(env.HARNESS_E2E_ROOT) && !env.HARNESS_E2E_OWNER;
}

/** Removes the directory of a run. A run that was given its directory leaves it alone. */
export function closeE2eRun(env: Environment = process.env): void {
	if (env.HARNESS_E2E_OWNER !== String(process.pid) || !env.HARNESS_E2E_ROOT) return;
	rmSync(env.HARNESS_E2E_ROOT, { recursive: true, force: true });
	rmSync(join(frozenBuilds, basename(env.HARNESS_E2E_ROOT)), { recursive: true, force: true });
}
