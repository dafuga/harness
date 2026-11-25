import { expect, test } from 'vitest';
import {
	TRACKER_EGRESS_BASELINE_HOSTS,
	claudeEgressArguments,
	codexEgressArguments,
	trackerEgressPolicy
} from '../../../src/utils/projects-sessions/trackerEgressPolicy';
import { trackerManagedProviderCommand } from '../../../src/adapters/projects-sessions/tracker-tmux-adapter/trackerManagedProviderCommands';

const policy = trackerEgressPolicy({
	trackerHosts: ['Hub.Example.com'],
	projectHosts: ['staging.example.com']
});

test('builds a sorted exact-host allowlist from the baseline, Tracker and project hosts', () => {
	expect(policy.hosts).toEqual([...policy.hosts].sort());
	expect(policy.hosts).toEqual(
		expect.arrayContaining([
			...TRACKER_EGRESS_BASELINE_HOSTS,
			'hub.example.com',
			'staging.example.com'
		])
	);
	expect(policy.hosts.some((host) => host.includes('*'))).toBe(false);
});

test.each([
	['wildcards', '*.example.com'],
	['IP literals', '10.0.0.5'],
	['URLs', 'https://hub.example.com'],
	['ports', 'hub.example.com:443'],
	['single labels', 'localhost']
])('fails closed on %s', (_name, host) => {
	expect(() => trackerEgressPolicy({ trackerHosts: [host] })).toThrow(/exact DNS names/u);
	expect(() =>
		trackerEgressPolicy({ trackerHosts: ['hub.example.com'], projectHosts: [host] })
	).toThrow(/exact DNS names/u);
});

test('fails closed without Tracker callback hosts', () => {
	expect(() => trackerEgressPolicy({ trackerHosts: [] })).toThrow(/Tracker callback host/u);
});

test('renders a Codex profile that denies unlisted hosts by default and keeps the sandbox', () => {
	const args = codexEgressArguments(policy);
	expect(args).toContain('default_permissions="tracker-egress"');
	expect(args).toContain('permissions.tracker-egress.network.mode="full"');
	expect(args.join(' ')).toContain('"hub.example.com"="allow"');
	expect(args.join(' ')).not.toContain('"deny"');
	expect(args).not.toContain('--dangerously-bypass-approvals-and-sandbox');
});

test('renders Claude settings with an exact domain list, no unsandboxed commands and web tools off', () => {
	const args = claudeEgressArguments(policy);
	const settings = JSON.parse(args[args.indexOf('--settings') + 1]);
	expect(settings.sandbox).toMatchObject({ enabled: true, allowUnsandboxedCommands: false });
	expect(settings.sandbox.network.allowedDomains).toEqual(policy.hosts);
	expect(args).toContain('--strict-mcp-config');
	expect(args[args.indexOf('--disallowedTools') + 1]).toBe('WebFetch,WebSearch');
});

const base = { codex: '/bin/codex', claude: '/bin/claude', profile: '/profile' };
const request = (provider: 'codex' | 'claude') =>
	({
		platform: 'macos',
		backend: 'native',
		itemId: 'abc123def4',
		selection: { provider, model: 'm', intelligence: 'high' }
	}) as never;

test('native launches without a policy keep the November 23 open-access commands', () => {
	const codex = trackerManagedProviderCommand(
		{ native: base },
		request('codex'),
		'/b.md',
		'darwin'
	);
	const claude = trackerManagedProviderCommand(
		{ native: base },
		request('claude'),
		'/b.md',
		'darwin'
	);
	expect(codex?.argv).toContain('--dangerously-bypass-approvals-and-sandbox');
	expect(claude?.argv).not.toContain('--settings');
});

test('native launches with a policy drop the Codex sandbox bypass and add the allowlist', () => {
	const native = { ...base, egress: policy };
	const codex = trackerManagedProviderCommand({ native }, request('codex'), '/b.md', 'darwin');
	expect(codex?.argv).not.toContain('--dangerously-bypass-approvals-and-sandbox');
	expect(codex?.argv).toEqual(
		expect.arrayContaining(['-a', 'never', ...codexEgressArguments(policy)])
	);
	const claude = trackerManagedProviderCommand({ native }, request('claude'), '/b.md', 'darwin');
	expect(claude?.argv).toEqual(expect.arrayContaining(claudeEgressArguments(policy)));
});
