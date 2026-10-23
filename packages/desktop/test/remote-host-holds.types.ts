import type { hostFixture } from './remote-host-fixture';

export type HostFixture = Awaited<ReturnType<typeof hostFixture>>;
