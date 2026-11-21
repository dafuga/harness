import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { ManagedProviderDockerAdapter } from '../../../src/adapters/agents-providers/ManagedProviderDockerAdapter';
import { dockerTaskImage } from '../../../src/adapters/agents-providers/module-task-runner-adapter/taskProcess';
import { observedTaskOperation } from '../../support/taskProfiles';

const image = 'sha256:' + 'a'.repeat(64);

test('Docker command preserves argv and uses a task-owned workspace volume and bounded tmpfs', async () => {
	const args = ['-c', 'printf "%s" "$1"', 'literal', '$(touch unexpected); * "', ''];
	const command = await observedTaskOperation(
		'adapter.agents-providers-managed-provider-docker',
		'plan-offline-provider-process',
		() =>
			new ManagedProviderDockerAdapter().command(['/bin/sh', ...args], {
				cwd: '/private/tmp/a space,with "quotes"',
				image,
				owner: 'fixture-owner',
				user: '501:20'
			})
	);
	expect(command).toEqual([
		'create',
		'--interactive',
		'--init',
		'--pull=never',
		'--network=none',
		'--cap-drop=ALL',
		'--security-opt=no-new-privileges',
		'--read-only',
		'--no-healthcheck',
		'--log-driver=none',
		'--pids-limit=256',
		'--cpus=2',
		'--memory=6144m',
		'--memory-swap=6144m',
		'--user=501:20',
		'--tmpfs=/tmp:rw,nosuid,nodev,size=256m',
		'--env=HOME=/tmp',
		'--env=TMPDIR=/tmp',
		'--env=BUN_INSTALL_CACHE_DIR=/workspace/.cache/harness/bun',
		'--mount=type=volume,source=harness-task-fixture-owner,target=/workspace,volume-nocopy,"volume-subpath=a space,with ""quotes"""',
		'--workdir=/workspace',
		'--label=org.harness.managed-provider-task=fixture-owner',
		'--entrypoint=/bin/sh',
		image,
		...args
	]);
});

test('only explicit Linux uses a pinned local image, and macOS tooling requires Darwin', () => {
	expect(dockerTaskImage(undefined, 'linux', image)).toBeUndefined();
	expect(dockerTaskImage('macos', 'darwin', image)).toBeUndefined();
	expect(() => dockerTaskImage('macos', 'linux', image)).toThrow('native macOS');
	expect(dockerTaskImage('linux', 'darwin', image)).toBe(image);
	expect(dockerTaskImage('linux', 'linux', image)).toBe(image);
	expect(() => dockerTaskImage('linux', 'win32', image)).toThrow('Linux or macOS host');
	expect(() => dockerTaskImage('linux', 'darwin')).toThrow('HARNESS_TASK_DOCKER_IMAGE');
	expect(() => dockerTaskImage('linux', 'darwin', 'fixture:mutable')).toThrow('full ID');
});
