import type { localFixture } from './local-transport-fixture';

export type Fixture = Awaited<ReturnType<typeof localFixture>>;
