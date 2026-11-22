// @harness-uid u_wxnd4lveb5
import { isIPv4 } from 'node:net';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import type { VaultEgressInput, VaultEgressRules } from './vaultEgressRules.types';

/**
 * Renders the ruleset the container loads into its own network namespace before Chromium starts.
 * Output is dropped by default. Chromium may reach only the loopback proxy, and only the proxy user
 * may resolve names and open TCP 443. The proxy admits CONNECT to the returned hosts only.
 */
export function vaultEgressRules(input: VaultEgressInput): VaultEgressRules {
	checkInput(input);
	const proxyHosts = [...new Set(input.origins.concat(input.redirects).map(hostOf))].sort();
	const proxy = String(input.proxyUid);
	const nftables = [
		'flush ruleset',
		'table inet vault_egress {',
		'\tchain output {',
		'\t\ttype filter hook output priority 0; policy drop;',
		'\t\tct state established,related accept',
		'\t\toif "lo" meta skuid ' + input.browserUid + ' tcp dport ' + input.proxyPort + ' accept',
		'\t\toif "lo" meta skuid ' + proxy + ' accept',
		'\t\tmeta skuid ' + proxy + ' ip daddr ' + input.resolver + ' udp dport 53 accept',
		'\t\tmeta skuid ' + proxy + ' ip daddr ' + input.resolver + ' tcp dport 53 accept',
		'\t\tmeta skuid ' + proxy + ' tcp dport 443 accept',
		'\t}',
		'}',
		''
	].join('\n');
	return { nftables, proxyHosts };
}

function checkInput(input: VaultEgressInput): void {
	const ids = [input.proxyUid, input.browserUid];
	if (
		ids.some((uid) => !Number.isInteger(uid) || uid <= 0) ||
		input.proxyUid === input.browserUid
	) {
		throw new ExpectedCliError('Egress rules need distinct nonroot proxy and browser users.');
	}
	if (!Number.isInteger(input.proxyPort) || input.proxyPort < 1024 || input.proxyPort > 65_535) {
		throw new ExpectedCliError('The egress proxy port must be an unprivileged TCP port.');
	}
	if (!isIPv4(input.resolver)) throw new ExpectedCliError('The resolver must be an IPv4 address.');
	if (input.origins.length === 0)
		throw new ExpectedCliError('Egress rules need at least one origin.');
}

function hostOf(origin: string): string {
	const url = new URL(origin);
	if (url.protocol !== 'https:' || url.port !== '' || url.origin !== origin) {
		throw new ExpectedCliError('Egress origins must be exact https origins: ' + origin);
	}
	return url.hostname;
}
