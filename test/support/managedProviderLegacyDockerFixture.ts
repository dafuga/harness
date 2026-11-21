import { $ } from 'bun';
import { randomUUID } from 'node:crypto';
import { mkdir, realpath } from 'node:fs/promises';
import { ProcessIdentityAdapter } from '../../src/services/agents-providers/agent-activity-service/ProcessIdentityAdapter';
import {
	launchDirectory,
	writeLaunch
} from '../../src/adapters/agents-providers/managed-provider-docker-adapter/dockerLaunchJournal';

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
