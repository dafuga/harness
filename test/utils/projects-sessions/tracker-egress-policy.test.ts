import { expect, test } from 'vitest';
import {
	TRACKER_EGRESS_BASELINE_HOSTS,
	claudeEgressArguments,
	codexEgressArguments,
	trackerEgressPolicy
} from '../../../src/utils/projects-sessions/trackerEgressPolicy';
import { trackerHostEffectsSchema } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostEffectsSchema';
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
	expect(args).toContain('permissions.tracker-egress.network.allow_local_binding=true');
	expect(args.join(' ')).toContain('"127.0.0.1"="allow"');
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

const modelLimit = { availableModels: ['opus', 'sonnet', 'haiku'] };
const claudeSettings = (command?: { argv: string[] }) =>
	JSON.parse(command!.argv[command!.argv.indexOf('--settings') + 1]);

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
	expect(claudeSettings(claude)).toEqual(modelLimit);
});

test('native launches with a policy drop the Codex sandbox bypass and add the allowlist', () => {
	const native = { ...base, egress: { items: ['abc123def4'], policy } };
	const codex = trackerManagedProviderCommand({ native }, request('codex'), '/b.md', 'darwin');
	expect(codex?.argv).not.toContain('--dangerously-bypass-approvals-and-sandbox');
	expect(codex?.argv).toEqual(
		expect.arrayContaining(['-a', 'never', ...codexEgressArguments(policy)])
	);
	const claude = trackerManagedProviderCommand({ native }, request('claude'), '/b.md', 'darwin');
	const egress = claudeEgressArguments(policy);
	const allowlist = JSON.parse(egress[egress.indexOf('--settings') + 1]);
	expect(claudeSettings(claude)).toEqual({ ...allowlist, ...modelLimit });
	expect(claude?.argv).toEqual(
		expect.arrayContaining(egress.filter((arg) => !arg.startsWith('{')))
	);
	expect(claude?.argv).not.toContain('--remote-control');
});

test('native launches for items outside the pilot keep open access even when a policy exists', () => {
	const native = { ...base, egress: { items: ['zzzzzzzzzz'], policy } };
	const codex = trackerManagedProviderCommand({ native }, request('codex'), '/b.md', 'darwin');
	expect(codex?.argv).toContain('--dangerously-bypass-approvals-and-sandbox');
	const claude = trackerManagedProviderCommand({ native }, request('claude'), '/b.md', 'darwin');
	expect(claudeSettings(claude)).toEqual(modelLimit);
});

const active = (egress: unknown) => ({
	mode: 'active',
	checkpoint: 'pilot',
	launch: {
		managed: {
			tmux: '/usr/bin/tmux',
			stateDirectory: '/state',
			trackerBinDirectory: '/bin',
			native: { codex: '/c', claude: '/cl', profile: '/p', egress }
		},
		repositories: {}
	}
});

test('launcher config accepts a pilot policy and fails closed on bad hosts or items', () => {
	const hosts = { items: ['abc123def4'], trackerHosts: ['daniel-primary-mbp.example.ts.net'] };
	const ok = trackerHostEffectsSchema.safeParse(active(hosts));
	expect(ok.success).toBe(true);
	for (const bad of [
		{ ...hosts, trackerHosts: ['*.example.com'] },
		{ ...hosts, projectHosts: ['10.0.0.1'] },
		{ ...hosts, items: [] },
		{ ...hosts, extra: true }
	])
		expect(trackerHostEffectsSchema.safeParse(active(bad)).success).toBe(false);
});

test('Tracker hosts may be exact tailnet addresses, project hosts and other addresses may not', () => {
	expect(trackerEgressPolicy({ trackerHosts: ['100.69.65.18'] }).hosts).toContain('100.69.65.18');
	for (const host of ['100.63.0.1', '100.128.0.1', '10.0.0.5', '8.8.8.8'])
		expect(() => trackerEgressPolicy({ trackerHosts: [host] })).toThrow(/exact DNS names/u);
	expect(() =>
		trackerEgressPolicy({ trackerHosts: ['hub.example.com'], projectHosts: ['100.69.65.18'] })
	).toThrow(/exact DNS names/u);
});
