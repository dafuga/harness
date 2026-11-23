import type { nativeGoogleFixture } from './nativeGoogleFixture';

/** One request the Hub spy received from the real publisher wire. */
export type HubSpyRecord = {
	method: string;
	path: string;
	bearer: string | null;
	body: string;
};

export type HubSpy = {
	origin: string;
	records: HubSpyRecord[];
	login: ReturnType<typeof nativeGoogleFixture>;
	denyOverviewReads(): void;
	close(): Promise<void>;
};
