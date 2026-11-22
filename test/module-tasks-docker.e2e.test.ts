import { test } from 'vitest';
import {
	verifyDockerWorker,
	verifyDockerOrchestrator,
	verifyDockerProcess
} from './support/moduleTaskDockerFixture';

// Opt-in Linux Docker pilot: set HARNESS_TEST_DOCKER_BASE to a prepared local image. These stay
// out of the module-tasks scenario, whose checks must run every test they list.
const dockerBase = process.env.HARNESS_TEST_DOCKER_BASE;
test.skipIf(!dockerBase)(
	'Linux worker runs the provider fixture in Docker',
	() => verifyDockerWorker(dockerBase!),
	60000
);
test.skipIf(!dockerBase)(
	'Linux orchestrator uses the same Docker provider fixture',
	() => verifyDockerOrchestrator(dockerBase!),
	60000
);
test.skipIf(!dockerBase)(
	'Linux process preserves its exit and recovers scoped containers after cancellation and restart',
	() => verifyDockerProcess(dockerBase!),
	60000
);
