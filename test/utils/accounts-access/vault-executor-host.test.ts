import { expect, test } from 'vitest';
import { vaultExecutorHost } from '../../../src/utils/accounts-access/vaultExecutorHost';
import type { VaultHostProbe } from '../../../src/utils/accounts-access/vaultExecutorHost.types';

const mac: VaultHostProbe = {
	host: 'mb2',
	isolation: 'os-user',
	sharedSudoHost: false,
	agent: {
		uid: 501,
		groups: ['staff'],
		sudo: false,
		dockerSocket: false,
		executorHomeWritable: false
	},
	executor: { uid: 502 },
	chromiumSandbox: true
};

test('admits a separate executor user the agent cannot escalate to', () => {
	expect(vaultExecutorHost(mac)).toEqual({ eligible: true, host: 'mb2', isolation: 'os-user' });
});

test('refuses an agent with Docker, sudo, root or a shared user', () => {
	const cases: Partial<VaultHostProbe>[] = [
		{ agent: { ...mac.agent, groups: ['staff', 'docker'] } },
		{ agent: { ...mac.agent, dockerSocket: true } },
		{ agent: { ...mac.agent, sudo: true } },
		{ agent: { ...mac.agent, uid: 0 } },
		{ agent: { ...mac.agent, executorHomeWritable: true } },
		{ executor: { uid: 501 } },
		{ isolation: 'none' },
		{ chromiumSandbox: false }
	];
	for (const change of cases) expect(vaultExecutorHost({ ...mac, ...change }).eligible).toBe(false);
});

test('keeps automated logins off a shared passwordless-sudo box unless a VM is out of reach', () => {
	const box: VaultHostProbe = {
		...mac,
		host: 'grok-box',
		sharedSudoHost: true,
		agent: { ...mac.agent, groups: ['sudo'], sudo: true }
	};
	expect(vaultExecutorHost(box)).toMatchObject({ eligible: false });
	expect(vaultExecutorHost({ ...box, isolation: 'vm' })).toMatchObject({ eligible: false });
	const remoteVm = { ...box, isolation: 'vm' as const, agent: { ...mac.agent } };
	expect(vaultExecutorHost(remoteVm)).toMatchObject({ eligible: true, isolation: 'vm' });
});
