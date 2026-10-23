import type { fixture } from '../run-fixture';

export type Fixture = Awaited<ReturnType<typeof fixture>>;
