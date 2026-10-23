import type { startHubRelay } from './hubRelayFixture';

export type Call = (
	session: string | null,
	method: string,
	path: string,
	body?: unknown
) => Promise<Response>;

export type HubRelayFixture = Awaited<ReturnType<typeof startHubRelay>>;
