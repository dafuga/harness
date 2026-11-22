// @harness-uid u_geopxvz5u4
import type { VaultHostProbe, VaultHostVerdict } from './vaultExecutorHost.types';

const privilegedGroups = new Set([
	'docker',
	'admin',
	'wheel',
	'sudo',
	'root',
	'lxd',
	'libvirt',
	'kvm'
]);

/**
 * Admits a host for automated browser logins only when the executor is out of the agent's reach:
 * a separate OS user the agent cannot escalate to, or a VM. A host that gives every bot
 * passwordless sudo qualifies only through a VM.
 */
export function vaultExecutorHost(probe: VaultHostProbe): VaultHostVerdict {
	const reasons = probe.isolation === 'vm' ? vmReasons(probe) : userReasons(probe);
	if (!probe.chromiumSandbox) reasons.push('The Chromium sandbox preflight failed.');
	if (reasons.length > 0 || probe.isolation === 'none') {
		return {
			eligible: false,
			host: probe.host,
			reasons: reasons.length ? reasons : ['No isolation.']
		};
	}
	return { eligible: true, host: probe.host, isolation: probe.isolation };
}

function vmReasons(probe: VaultHostProbe): string[] {
	return controlReasons(probe, 'the VM');
}

function userReasons(probe: VaultHostProbe): string[] {
	const reasons: string[] = [];
	if (probe.isolation === 'none') reasons.push('The executor shares the agent OS user.');
	if (probe.sharedSudoHost) {
		reasons.push('Every bot has passwordless sudo here; only a VM executor is allowed.');
	}
	if (!probe.executor || probe.executor.uid === probe.agent.uid) {
		reasons.push('The executor needs its own OS user.');
	}
	return reasons.concat(controlReasons(probe, 'the executor'));
}

function controlReasons(probe: VaultHostProbe, target: string): string[] {
	const reasons: string[] = [];
	if (probe.agent.uid === 0) reasons.push('The agent runs as root and controls ' + target + '.');
	const groups = probe.agent.groups.filter((group) => privilegedGroups.has(group));
	if (groups.length > 0)
		reasons.push('The agent is in privileged groups: ' + groups.join(', ') + '.');
	if (probe.agent.sudo) reasons.push('The agent can use sudo and control ' + target + '.');
	if (probe.agent.dockerSocket) reasons.push('The agent can reach a Docker socket.');
	if (probe.agent.executorHomeWritable) reasons.push('The agent can write the executor home.');
	return reasons;
}
