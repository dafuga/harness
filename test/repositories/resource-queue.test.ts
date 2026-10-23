import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { ResourceQueueRepository } from '../../src/services/execution-runtimes/resource-queue-service/ResourceQueueRepository';
import { config, job, snapshot } from '../support/resourceFixture';
test('independent connections cannot double reserve the same available capacity', () => {
	const home = mkdtempSync(join(tmpdir(), 'resource-db-')),
		first = new ResourceQueueRepository(home),
		second = new ResourceQueueRepository(home);
	try {
		const recent = snapshot();
		first.saveSnapshot(recent);
		second.saveSnapshot(snapshot({ sampledAt: recent.sampledAt - 1000 }));
		expect(second.snapshot()?.sampledAt).toBe(recent.sampledAt);
		const a = job({ cpus: 6 }),
			b = job({ cpus: 6 });
		first.add(a);
		second.add(b);
		first.schedule(snapshot(), config);
		second.schedule(snapshot(), config);
		expect(first.all().filter((j) => j.state === 'running')).toHaveLength(1);
		const queued = first.all().find((j) => j.state === 'queued')!;
		first.remove(first.all().find((j) => j.state === 'running')!.id);
		second.schedule(snapshot(), config);
		expect(second.all().find((j) => j.id === queued.id)?.state).toBe('running');
	} finally {
		first.close();
		second.close();
		rmSync(home, { recursive: true, force: true });
	}
});
