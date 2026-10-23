import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import type * as SQLite from 'node:sqlite';
import { afterAll } from 'vitest';
import './support/gameWorkload';
const home = mkdtempSync(join(tmpdir(), 'harness-tests-analytics-'));
process.env.HARNESS_ANALYTICS_HOME = home;
process.env.PROJECT_REPORTS_HOME = join(home, 'reports');
process.env.PROJECT_REPORTS_ASSET_STORAGE = 'local';
afterAll(() => {
	traceResources();
	rmSync(home, { recursive: true, force: true });
});

/** Optional read-only CI diagnostics contain scheduling data, never command text or environment. */
function traceResources(): void {
	if (process.env.HARNESS_RESOURCE_PROGRESS !== '1') return;
	const path = join(
		process.env.HARNESS_RESOURCES_HOME ?? join(homedir(), '.codex', 'harness', 'resources'),
		'queue.sqlite'
	);
	if (!existsSync(path)) return;
	try {
		const { DatabaseSync } = createRequire(join(process.cwd(), 'resource-diagnostics.cjs'))(
			'node:sqlite'
		) as typeof SQLite;
		const db = new DatabaseSync(path, { readOnly: true });
		try {
			const rows = db.prepare('SELECT data FROM resource_jobs ORDER BY sequence').all() as Array<{
				data: string;
			}>;
			const jobs = rows.map((row) => JSON.parse(row.data) as Record<string, unknown>);
			if (!jobs.some((job) => job.state === 'queued')) return;
			const snapshot = db.prepare("SELECT data FROM resource_state WHERE id='snapshot'").get() as
				| { data: string }
				| undefined;
			const fields = [
				'id',
				'parentId',
				'state',
				'cpus',
				'memoryMiB',
				'ownerPid',
				'workerPid',
				'notice'
			];
			const waiting = jobs
				.slice(0, 32)
				.map((job) => Object.fromEntries(fields.map((key) => [key, job[key]])));
			console.error(
				'[harness resources] queue-state ' +
					JSON.stringify({
						inherited: {
							lease: process.env.HARNESS_RESOURCE_LEASE,
							cpus: process.env.HARNESS_RESOURCE_CPUS,
							memoryMiB: process.env.HARNESS_RESOURCE_MEMORY_MIB
						},
						snapshot: snapshot ? JSON.parse(snapshot.data) : null,
						jobs: waiting,
						total: jobs.length
					})
			);
		} finally {
			db.close();
		}
	} catch {
		console.error('[harness resources] Queue diagnostics unavailable');
	}
}
