// @harness-uid u_wxnd4lveb5

export interface VaultEgressInput {
	origins: string[];
	redirects: string[];
	proxyUid: number;
	browserUid: number;
	proxyPort: number;
	resolver: string;
}

export interface VaultEgressRules {
	nftables: string;
	proxyHosts: string[];
}
