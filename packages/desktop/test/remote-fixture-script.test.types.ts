import type { startRemoteFixture } from '../scripts/remote-fixture-host';

/** The standalone fixture as root runs it, and a stand-in for the simulator's phone. */
export type Fixture = Awaited<ReturnType<typeof startRemoteFixture>>;
