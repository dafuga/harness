import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { addAbortListener, once } from 'node:events';
import { realpathSync } from 'node:fs';
import process from 'node:process';
import { ManagedProviderDockerAdapter } from '../../src/adapters/agents-providers/ManagedProviderDockerAdapter';
import { readFrames, writeFrame } from './frames.mjs';

const dockerEnv = { PATH: process.env.PATH, HOME: process.env.HOME };

class ProofDockerAdapter extends ManagedProviderDockerAdapter {
	command(args, task) {
		const command = super.command(args, task);
		this.label = command.find((argument) => argument.startsWith('--label=')).slice(8);
		return command;
	}
}

export function localDocker() {
	const endpoint = execFileSync(
		'docker',
		['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'],
		{
			encoding: 'utf8',
			env: dockerEnv,
			timeout: 15_000
		}
	).trim();
	assert(/^unix:\/\/\/[^\r\n]+$/.test(endpoint), 'A local Docker Unix socket context is required');
	return (...args) =>
		execFileSync('docker', ['--host', endpoint, ...args], {
			encoding: 'utf8',
			env: dockerEnv,
			timeout: 15_000
		}).trim();
}

function assertContainer(docker, id, workspace) {
	const [container] = JSON.parse(docker('inspect', id));
	const { HostConfig: host, Config: config, Mounts: mounts } = container;
	assert(/^[1-9]\d*:\d+$/.test(config.User));
	assert.equal(host.NetworkMode, 'none');
	assert.equal(host.ReadonlyRootfs, true);
	assert.equal(host.Privileged, false);
	assert.deepEqual(host.CapDrop, ['ALL']);
	assert.deepEqual(host.SecurityOpt, ['no-new-privileges']);
	assert.deepEqual(
		mounts.map(({ Type, Source, Destination }) => [Type, Source, Destination]),
		[['bind', workspace, '/workspace']]
	);
}

async function collect(child, scope, signal) {
	const closed = once(child, 'close');
	closed.catch(() => {});
	const kill = () => child.kill('SIGKILL');
	const abort = addAbortListener(signal, kill);
	child.stdin.on('error', () => {});
	child.stderr.pipe(process.stderr, { end: false });
	try {
		for await (const frame of readFrames(child.stdout)) {
			await writeFrame(child.stdin, JSON.stringify(await scope.reply(frame)));
		}
		child.stdin.end();
		const [code] = await closed;
		signal.throwIfAborted();
		assert.equal(code, 0, 'Guest assertions failed');
	} finally {
		abort[Symbol.dispose]();
		if (child.exitCode === null && child.signalCode === null) kill();
		await closed.catch(() => {});
	}
}

export async function runGuest(docker, task, scope, args) {
	const adapter = new ProofDockerAdapter();
	const findOwned = () => docker('ps', '-aq', '--filter', `label=${adapter.label}`);
	try {
		await adapter.run(['bun', '/workspace/guest.js', ...args], task, async (child) => {
			const id = findOwned();
			assert(/^[a-f0-9]{12}$/.test(id), 'Expected one task-owned guest');
			assertContainer(docker, id, realpathSync(task.cwd));
			await collect(child, scope, task.signal);
		});
	} finally {
		if (adapter.label) assert.equal(findOwned(), '', 'Task-owned container cleanup failed');
	}
}
