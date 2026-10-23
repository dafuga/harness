import type { runnerFixture } from './support/sourceProfileRunners';
export type Fixture = Awaited<ReturnType<typeof runnerFixture>>;
