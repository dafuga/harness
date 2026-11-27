import type { startRemoteFixture } from '../../scripts/remote-fixture-host';
import type { spyProcess } from './desktop.script.remote-fixture.test';

export type Fixture = Awaited<ReturnType<typeof startRemoteFixture>>;

export type Spies = ReturnType<typeof spyProcess>;
