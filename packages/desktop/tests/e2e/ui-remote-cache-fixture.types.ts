export type Call = { method: string; input: unknown };

export type Answer = { value: unknown; cachedAt?: string };

export type Native = (plugin: string, method: string, input: Call) => Promise<Answer>;

export type Kept = { hit: boolean; value?: unknown };

export interface CacheOptions {
	savedAt: string;
	kept: string[];
}

export interface CacheHost {
	Capacitor: { nativePromise: Native };
	__remotePhone: { phone: { state: string } };
	__phoneCache: (op: 'save' | 'read', key: string, value?: unknown) => Promise<Kept>;
}
