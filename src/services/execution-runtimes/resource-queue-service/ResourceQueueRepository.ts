import type {
	ResourceConfig,
	ResourceJob,
	ResourceSnapshot
} from '../../../core/execution-runtimes/resourceTypes';
import { resourceJobSchema } from '../../../core/execution-runtimes/resourceTypes';
import { resourceHome } from '../../../utils/execution-runtimes/resourceConfig';
import { resourcePolicy } from './resource-policy/resourcePolicy';
import { resourceDatabase, type ResourceDatabase } from './resourceDatabase';
/** Every reservation decision reads and updates the shared queue under BEGIN IMMEDIATE. */
export class ResourceQueueRepository {
	private readonly db: ResourceDatabase;
	constructor(home = resourceHome()) {
		this.db = resourceDatabase(home);
	}
	all(): ResourceJob[] {
		return (
			this.db.query('SELECT sequence,data FROM resource_jobs ORDER BY sequence').all() as Array<{
				sequence: number;
				data: string;
			}>
		).map((r) => resourceJobSchema.parse({ ...JSON.parse(r.data), sequence: r.sequence }));
	}
	add(job: Omit<ResourceJob, 'sequence'>): void {
		this.db
			.query('INSERT INTO resource_jobs(id,data) VALUES (?,?)')
			.run(job.id, JSON.stringify(job));
	}
	patch(id: string, changes: Partial<ResourceJob>): void {
		this.atomic(() => {
			const job = this.all().find((j) => j.id === id);
			if (job) this.write({ ...job, ...changes });
		});
	}
	remove(id: string): void {
		this.db.query('DELETE FROM resource_jobs WHERE id=?').run(id);
	}
	schedule(sample: ResourceSnapshot, config: ResourceConfig, now = Date.now()): ResourceJob[] {
		return this.atomic(() => {
			const jobs = this.all(),
				decision = resourcePolicy(jobs, sample, config, now);
			for (const job of jobs) {
				if (decision.granted.includes(job.id)) {
					job.state = 'running';
					job.notice = null;
					this.write(job);
				} else if (job.state === 'queued' && job.notice !== decision.reason) {
					job.notice = decision.reason;
					this.write(job);
				}
			}
			return jobs;
		});
	}
	snapshot(): ResourceSnapshot | undefined {
		const row = this.db.query("SELECT data FROM resource_state WHERE id='snapshot'").get() as {
			data: string;
		} | null;
		return row ? JSON.parse(row.data) : undefined;
	}
	saveSnapshot(sample: ResourceSnapshot): void {
		this.atomic(() => {
			const previous = this.snapshot();
			// A clock jump must not pin a future sample in the cache forever.
			if (previous && previous.sampledAt <= Date.now() && previous.sampledAt > sample.sampledAt)
				return;
			this.db
				.query(
					"INSERT INTO resource_state(id,data) VALUES ('snapshot',?) ON CONFLICT(id) DO UPDATE SET data=excluded.data"
				)
				.run(JSON.stringify(sample));
		});
	}
	close(): void {
		this.db.close();
	}
	private write(job: ResourceJob): void {
		this.db.query('UPDATE resource_jobs SET data=? WHERE id=?').run(JSON.stringify(job), job.id);
	}
	private atomic<T>(action: () => T): T {
		this.db.exec('BEGIN IMMEDIATE');
		try {
			const result = action();
			this.db.exec('COMMIT');
			return result;
		} catch (error) {
			this.db.exec('ROLLBACK');
			throw error;
		}
	}
}
