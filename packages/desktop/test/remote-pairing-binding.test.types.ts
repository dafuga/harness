import type { hostFixture } from './remote-host-fixture';

export type Fixture = Awaited<ReturnType<typeof hostFixture>>;
