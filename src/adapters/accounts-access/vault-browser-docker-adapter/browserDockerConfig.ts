// @harness-uid u_bjzxwihuau
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { isIPv4 } from 'node:net';
import type { DockerTaskDaemon } from '../../agents-providers/ManagedProviderDockerAdapter.types';
import {
	containerIdPattern,
	dockerControl
} from '../../agents-providers/managed-provider-docker-adapter/dockerControl';
import { vaultEgressRules } from '../../../utils/accounts-access/vaultEgressRules';
import type { VaultEgressRules } from '../../../utils/accounts-access/vaultEgressRules.types';
import type {
	VaultBrowserDockerAdapterConfig,
	VaultFixtureNetwork
} from '../VaultBrowserDockerAdapter.types';
import { vaultDockerLabel } from './browserDockerJournal';

const fixtureHost = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.test$/u;

export function browserDockerArgs(
	config: VaultBrowserDockerAdapterConfig,
	owner: string,
	egress: VaultEgressRules,
	network?: VaultFixtureNetwork
): string[] {
	return [
		'create',
		'--pull=never',
		'--read-only',
		'--cap-drop=ALL',
		'--cap-add=NET_ADMIN',
		'--cap-add=SETGID',
		'--cap-add=SETUID',
		'--cap-add=SETPCAP',
		'--user=0:0',
		'--security-opt=no-new-privileges',
		'--security-opt=seccomp=' + config.seccomp,
		'--network=' + (network?.id ?? 'none'),
		'--label=' + vaultDockerLabel + '=' + owner,
		'--cpus=2',
		'--memory=2g',
		'--pids-limit=256',
		'--shm-size=128m',
		'--tmpfs=/work:rw,nosuid,nodev,noexec,size=512m,mode=0700,uid=10001,gid=10001',
		'--tmpfs=/tmp:rw,nosuid,nodev,noexec,size=128m,mode=1777',
		'--env=VAULT_NFT_RULES=' + egress.nftables,
		'--env=VAULT_PROXY_HOSTS=' + egress.proxyHosts.join(','),
		...(network
			? Object.entries(network.hosts).map(([host, ip]) => `--add-host=${host}:${ip}`)
			: []),
		config.image
	];
}

export function browserDockerEgress(origins: string[], redirects: string[]): VaultEgressRules {
	const rules = vaultEgressRules({
		origins,
		redirects,
		resolver: '127.0.0.11',
		proxyUid: 10002,
		browserUid: 10001,
		proxyPort: 32449
	});
	if (rules.proxyHosts.some((host) => !fixtureHost.test(host))) {
		throw new ExpectedCliError('The fixture executor accepts only synthetic .test origins.');
	}
	return rules;
}

export function validateFixtureNetwork(network: VaultFixtureNetwork, hosts: string[]): void {
	if (!containerIdPattern.test(network.id))
		throw new ExpectedCliError('Use the full private Docker network ID.');
	// An explicit hosts map may include a deliberately denied host as a negative control.
	if (
		Object.entries(network.hosts).some(([host, ip]) => !fixtureHost.test(host) || !isIPv4(ip)) ||
		hosts.some((host) => !Object.hasOwn(network.hosts, host))
	) {
		throw new ExpectedCliError('Each fixture host needs a mapped IPv4 fixture address.');
	}
}

export async function requireInternalNetwork(daemon: DockerTaskDaemon, id: string): Promise<void> {
	const output = await dockerControl(daemon, [
		'network',
		'inspect',
		'--format',
		'{{.Id}} {{.Internal}}',
		id
	]);
	if (output !== id + ' true')
		throw new ExpectedCliError('Use an internal-only network for Vault fixtures.');
}
