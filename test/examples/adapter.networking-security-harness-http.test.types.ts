import type { HarnessHttpAdapter } from '../../src/adapters/networking-security/HarnessHttpAdapter';

export type FetchCall = {
	url: string;
	method: string;
	headers: Record<string, string>;
	redirect: string;
	body?: string;
};

export type Reply = Awaited<ReturnType<HarnessHttpAdapter['request']>>;
