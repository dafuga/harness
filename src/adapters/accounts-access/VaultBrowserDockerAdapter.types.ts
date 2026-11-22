// @harness-uid u_bjzxwihuau
import type { VaultCdpPipe } from './vault-cdp-relay-adapter/VaultCdpPipe';

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
	pipe: VaultCdpPipe;
	close(): Promise<void>;
}
