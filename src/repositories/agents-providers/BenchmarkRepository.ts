import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { BenchmarkRun } from '../../core/agents-providers/subagentBenchmarkTypes';

export class BenchmarkRepository {
	constructor(
		readonly home = join(
			process.env.HARNESS_ANALYTICS_HOME ?? join(homedir(), '.codex', 'harness'),
			'benchmarks'
		)
	) {}
	directory(id: string): string {
		if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid benchmark run ID.');
		return join(this.home, id);
	}
	async save(run: BenchmarkRun): Promise<void> {
		const directory = this.directory(run.id);
		await mkdir(directory, { recursive: true, mode: 0o700 });
		const path = join(directory, 'run.json');
		await writeFile(`${path}.tmp`, JSON.stringify(run, null, 2), { mode: 0o600 });
		await rename(`${path}.tmp`, path);
	}
	async read(id: string): Promise<BenchmarkRun> {
		const run = JSON.parse(
			await readFile(join(this.directory(id), 'run.json'), 'utf8')
		) as BenchmarkRun;
		for (const trial of run.trials)
			if (trial.status === 'running' && !benchmarkOwnerAlive(run.ownerPid))
				trial.status = 'interrupted';
		return run;
	}
}

function benchmarkOwnerAlive(pid: number | undefined): boolean {
	if (!pid) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}
