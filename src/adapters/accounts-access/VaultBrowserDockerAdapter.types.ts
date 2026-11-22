// @harness-uid u_bjzxwihuau
import type { VaultCdpPipeStreams } from './vault-cdp-relay-adapter/VaultCdpPipe.types';

export interface VaultBrowserDockerAdapterConfig {
	image: string;
	seccomp: string;
	journal: string;
	context?: string;
}

export interface VaultBrowserDockerLaunch {
	origins: string[];
	redirects: string[];
	network?: VaultFixtureNetwork;
}

export interface VaultFixtureNetwork {
	id: string;
	hosts: Record<string, string>;
}

export interface VaultBrowserDockerSession {
	owner: string;
	pipe: VaultCdpPipeStreams;
	close(): Promise<void>;
}
