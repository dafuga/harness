import type { remoteFixture } from './remote-fixture';

export type Client = Awaited<
	ReturnType<ReturnType<Awaited<ReturnType<typeof remoteFixture>>['device']>['connect']>
>['client'];
