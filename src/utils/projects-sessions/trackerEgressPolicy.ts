// @harness-uid u_xvchqaifoy
// @harness-uid u_egrpol0001
import { isIP } from 'node:net';
import type {
	TrackerEgressPolicy,
	TrackerEgressPolicyInput,
	TrackerEgressProvider
} from './trackerEgressPolicy.types';

/** Exact hosts for the services Daniel listed plus provider authentication. No wildcards. */
export const TRACKER_EGRESS_BASELINE_HOSTS = [
	'github.com',
	'api.github.com',
	'codeload.github.com',
	'objects.githubusercontent.com',
	'raw.githubusercontent.com',
	'registry.npmjs.org',
	'api.cloudflare.com',
	'api.twilio.com',
	'api.stripe.com',
	'oauth2.googleapis.com',
	'www.googleapis.com',
	'api.openai.com',
	'auth.openai.com',
	'chatgpt.com',
	'api.anthropic.com',
	'console.anthropic.com',
	'claude.ai'
] as const;

const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u;

/**
 * Builds the pilot's allowlist. It fails closed: without Tracker callback hosts, or with any
 * wildcard, IP literal, URL or malformed name, no policy is produced and the launch must not start.
 */
export function trackerEgressPolicy(input: TrackerEgressPolicyInput): TrackerEgressPolicy {
	if (input.trackerHosts.length === 0)
		throw new TypeError('The egress pilot needs at least one Tracker callback host');
	const extra = [...input.trackerHosts, ...(input.projectHosts ?? [])].map(exactHost);
	return { hosts: [...new Set([...TRACKER_EGRESS_BASELINE_HOSTS, ...extra])].sort() };
}

function exactHost(raw: string): string {
	const host = raw.trim().toLowerCase();
	if (isIP(host) !== 0 || !HOSTNAME.test(host))
		throw new TypeError(`Egress hosts must be exact DNS names without wildcards or ports: ${raw}`);
	return host;
}

/**
 * Codex flags: a named permission profile whose network proxy denies everything not listed. The
 * proxy covers Codex-started shell children; it is not a substitute for host-level enforcement.
 */
export function codexEgressArguments(policy: TrackerEgressPolicy): string[] {
	const domains = Object.fromEntries(policy.hosts.map((host) => [host, 'allow']));
	return [
		'--enable',
		'network_proxy',
		'-c',
		'default_permissions="tracker-egress"',
		'-c',
		'permissions.tracker-egress.extends=":workspace"',
		'-c',
		'permissions.tracker-egress.network.enabled=true',
		'-c',
		'permissions.tracker-egress.network.mode="full"',
		'-c',
		`permissions.tracker-egress.network.domains=${tomlInlineTable(domains)}`
	];
}

function tomlInlineTable(entries: Record<string, string>): string {
	return `{${Object.entries(entries)
		.map(([key, value]) => `${JSON.stringify(key)}=${JSON.stringify(value)}`)
		.join(',')}}`;
}

/** Claude flags: sandboxed Bash with an exact domain allowlist; web, browser and remote tools off. */
export function claudeEgressArguments(policy: TrackerEgressPolicy): string[] {
	const settings = {
		sandbox: {
			enabled: true,
			autoAllowBashIfSandboxed: true,
			allowUnsandboxedCommands: false,
			network: { allowedDomains: [...policy.hosts] }
		}
	};
	return [
		'--settings',
		JSON.stringify(settings),
		'--strict-mcp-config',
		'--disallowedTools',
		'WebFetch,WebSearch'
	];
}

export function trackerEgressArguments(
	provider: TrackerEgressProvider,
	policy: TrackerEgressPolicy
): string[] {
	return provider === 'claude' ? claudeEgressArguments(policy) : codexEgressArguments(policy);
}
