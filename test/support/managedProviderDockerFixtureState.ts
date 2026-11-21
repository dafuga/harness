import { $ } from 'bun';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, realpath } from 'node:fs/promises';
import { basename } from 'node:path';
import { ProcessIdentityAdapter } from '../../src/services/agents-providers/agent-activity-service/ProcessIdentityAdapter';
import {
	launchDirectory,
	writeLaunch
} from '../../src/adapters/agents-providers/managed-provider-docker-adapter/dockerLaunchJournal';

const taskLabel = 'org.harness.managed-provider-task';
const storageLabel = 'org.harness.managed-provider-storage';

export async function abandonLegacyBind(directory: string) {
	await mkdir(directory);
	const cwd = await realpath(directory);
	const owner = randomUUID();
	const label = `org.harness.managed-provider-task=${owner}`;
	const host = (
		await $`docker context inspect --format '{{.Endpoints.docker.Host}}'`.quiet().text()
	).trim();
	const daemonId = (await $`docker --host ${host} info --format '{{.ID}}'`.quiet().text()).trim();
	const journal = await launchDirectory(cwd);
	const child = Bun.spawn(['/bin/sleep', '60']);
	try {
		const { startedAt } = new ProcessIdentityAdapter().find(child.pid);
		if (!startedAt) throw new Error('Could not establish the legacy fixture supervisor.');
		const receipt = { version: 1 as const, owner, cwd, host, daemonId, pid: child.pid, startedAt };
		await writeLaunch(journal, receipt);
		const args = [
			'create',
			'--pull=never',
			'--network=none',
			'--read-only',
			'--cap-drop=ALL',
			'--security-opt=no-new-privileges',
			`--user=${process.getuid!()}:${process.getgid!()}`,
			`--label=${label}`,
			`--mount=type=bind,source=${cwd},target=/workspace,bind-recursive=disabled`,
			'--entrypoint=/bin/false',
			process.env.HARNESS_TASK_DOCKER_IMAGE!
		];
		const containerId = (await $`docker --host ${host} ${args}`.quiet().text()).trim();
		await writeLaunch(journal, { ...receipt, containerId });
		return containerId;
	} finally {
		child.kill('SIGKILL');
		await child.exited;
	}
}

export async function waitForReady(marker: string, cwd: string) {
	const deadline = Date.now() + 12000;
	do {
		for (const id of await taskContainerIds()) {
			const guest = await inspectGuest(id, marker, basename(cwd));
			if (guest) return guest;
		}
		await Bun.sleep(50);
	} while (Date.now() < deadline);
	throw new Error('Linux child did not become ready for cancellation.');
}

export async function taskContainerIds() {
	const result = await $`docker ps --all --quiet --no-trunc --filter label=${taskLabel}`
		.quiet()
		.text();
	return result.trim().split(/\s+/).filter(Boolean);
}

export async function storageContainers(owner: string) {
	return (
		await $`docker ps -aq --no-trunc --filter label=${storageLabel}=${owner}`.quiet().text()
	).trim();
}

export async function volumeExists(volume: string) {
	const observed = await $`docker volume ls -q --filter name=${volume}`.quiet().text();
	return observed.trim().split('\n').includes(volume);
}

export async function guestRemoved(guest: { id: string; owner: string; volume: string }) {
	return (
		!(await taskContainerIds()).includes(guest.id) &&
		!(await storageContainers(guest.owner)) &&
		!(await volumeExists(guest.volume))
	);
}

export async function running(id: string) {
	const state = await $`docker inspect --format '{{.State.Running}}' ${id}`.quiet().nothrow();
	return state.exitCode === 0 && state.text().trim() === 'true';
}

async function inspectGuest(id: string, marker: string, subpath: string) {
	const result = await $`docker inspect ${id}`.quiet().nothrow();
	if (result.exitCode !== 0) return undefined;
	const [guest] = JSON.parse(result.text());
	if (!guest.Config.Cmd?.includes(marker) || !guest.State.Running) return undefined;
	const ready = await $`docker exec ${id} test -f /workspace/ready`.quiet().nothrow();
	if (ready.exitCode !== 0) return undefined;
	const { HostConfig: host, Mounts: mounts } = guest;
	assert.match(guest.Config.User, /^[1-9]\d*:\d+$/);
	assert.equal(host.NetworkMode, 'none');
	assert.equal(host.ReadonlyRootfs, true);
	assert.equal(host.Privileged, false);
	assert.deepEqual(host.CapDrop, ['ALL']);
	assert.deepEqual(host.SecurityOpt, ['no-new-privileges']);
	assert.equal(host.Tmpfs['/tmp'], 'rw,nosuid,nodev,size=256m');
	assert.equal(mounts.length, 1);
	assert.equal(mounts[0].Type, 'volume');
	assert.equal(mounts[0].Destination, '/workspace');
	const owner = guest.Config.Labels[taskLabel];
	assert.equal(mounts[0].Name, `harness-task-${owner}`);
	assert.match(owner, /^[a-f0-9-]{36}$/);
	assert.equal(host.Mounts[0].VolumeOptions.Subpath, subpath);
	return { id, owner, volume: mounts[0].Name as string };
}
