import type { startMacTrackerFixture } from './support/macTrackerFixture';

export type Tracker = Awaited<ReturnType<typeof startMacTrackerFixture>>;
