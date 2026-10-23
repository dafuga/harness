import { expect, test } from 'vitest';
import { abandonedResources } from '../../src/utils/execution-runtimes/resourceIdentity';
import { job } from '../support/resourceFixture';
const old = () => job({ heartbeatAt: Date.now() - 60000 });
test('only demonstrably abandoned requests are reclaimed, never living or reused worker identities', () => {
	const waiting = old(),
		running = old(),
		orphan = old(),
		reused = old();
	running.workerPid = 99;
	running.workerStarted = 'worker';
	orphan.workerPid = 100;
	orphan.workerStarted = 'orphan';
	reused.workerPid = 101;
	reused.workerStarted = 'previous';
	const rows = [
		{ pid: 99, started: 'worker', parent: 1, group: 99 },
		{ pid: 100, started: 'orphan', parent: 1, group: 100 },
		{ pid: 101, started: 'replacement', parent: 1, group: 101 }
	];
	expect(abandonedResources([waiting, running, orphan, reused], rows)).toEqual([
		waiting.id,
		reused.id
	]);
	expect(abandonedResources([job()], [])).toEqual([]);
});
