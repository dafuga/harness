import { expect, test } from 'vitest';
import { vaultEgressRules } from '../../../src/utils/accounts-access/vaultEgressRules';

const input = {
	origins: ['https://console.example.test'],
	redirects: ['https://sso.example.test', 'https://console.example.test'],
	proxyUid: 1100,
	browserUid: 1200,
	proxyPort: 3128,
	resolver: '10.0.0.53'
};

test('drops output by default and lets only the proxy user leave the container', () => {
	const { nftables, proxyHosts } = vaultEgressRules(input);
	expect(proxyHosts).toEqual(['console.example.test', 'sso.example.test']);
	expect(nftables).toContain('type filter hook output priority 0; policy drop;');
	expect(nftables).toContain('oif "lo" meta skuid 1200 tcp dport 3128 accept');
	expect(nftables).toContain('meta skuid 1100 ip daddr 10.0.0.53 udp dport 53 accept');
	const browserRules = nftables.split('\n').filter((line) => line.includes('skuid 1200'));
	expect(browserRules).toEqual(['\t\toif "lo" meta skuid 1200 tcp dport 3128 accept']);
	expect(nftables).not.toContain('policy accept');
});

test('rejects root or shared users, privileged ports, hostnames as resolvers and non-https origins', () => {
	expect(() => vaultEgressRules({ ...input, proxyUid: 0 })).toThrow(/nonroot/u);
	expect(() => vaultEgressRules({ ...input, browserUid: 1100 })).toThrow(/distinct/u);
	expect(() => vaultEgressRules({ ...input, proxyPort: 80 })).toThrow(/unprivileged/u);
	expect(() => vaultEgressRules({ ...input, resolver: 'dns.example.test' })).toThrow(/IPv4/u);
	expect(() => vaultEgressRules({ ...input, origins: ['http://console.example.test'] })).toThrow(
		/https/u
	);
	expect(() => vaultEgressRules({ ...input, origins: [] })).toThrow(/at least one/u);
});
