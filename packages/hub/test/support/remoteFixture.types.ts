import type { HubEnv } from '../../src/configs/hubEnvConfig';
import type { HubApiRuntime } from '../../src/utils/hubRuntime';
import type { remoteFixture } from './remoteFixture';

export interface HostIdentity {
	hostId: string;
	hostKey: string;
}

export interface RemoteFixtureOptions {
	/** Laid over the working settings; `undefined` removes one. */
	env?: Partial<HubEnv>;
	auth?: HubApiRuntime['auth'];
	connect?: HubApiRuntime['connect'];
}

export type RemoteFixture = ReturnType<typeof remoteFixture>;
