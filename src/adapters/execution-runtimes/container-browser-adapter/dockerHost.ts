// @harness-uid u_vzhwfqsqhp
import { execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Duplex } from 'node:stream';
import { promisify } from 'node:util';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import type { ContainerBrowserHost, DockerEndpoint } from '../ContainerBrowserAdapter.types';
import { colimaProfile } from './colimaRuntime';

const run = promisify(execFile);

/**
 * The local docker CLI against one engine socket, with a Docker config of its own. The user's
 * active context is never used, and their credential helper is never asked: a broken helper (for
 * example Docker Desktop's) would otherwise hang a public image pull.
 */
export function dockerHost(endpoint: DockerEndpoint = browserEndpoint()): ContainerBrowserHost {
	const env: Record<string, string | undefined> = {
		...process.env,
		DOCKER_CONFIG: endpoint.config
	};
	delete env.DOCKER_CONTEXT;
	const prefix = ['--host', `unix://${endpoint.socket}`];
	return {
		docker: async (args, timeoutMs = 30_000) => {
			ownDockerConfig(endpoint.config);
			try {
				const { stdout } = await run('docker', [...prefix, ...args], {
					env,
					timeout: timeoutMs,
					killSignal: 'SIGKILL',
					maxBuffer: 8 * 1024 * 1024
				});
				return stdout.trim();
			} catch (error) {
				const detail = (error as { stderr?: string }).stderr?.trim().split('\n').at(-1) ?? '';
				throw new ExpectedCliError(`docker ${args[0]} failed. ${detail}`.trim());
			}
		},
		stream: (args) => {
			ownDockerConfig(endpoint.config);
			return childStream('docker', [...prefix, ...args], env);
		}
	};
}

export function browserEndpoint(home: string = homedir()): DockerEndpoint {
	return {
		socket: join(home, '.colima', colimaProfile, 'docker.sock'),
		config: join(home, '.harness', 'container-browser', 'docker')
	};
}

/** No credentials: only the user's CLI plugins (for example buildx) stay available. */
function ownDockerConfig(directory: string): void {
	const file = join(directory, 'config.json');
	if (existsSync(file)) return;
	mkdirSync(directory, { recursive: true, mode: 0o700 });
	const plugins = join(homedir(), '.docker', 'cli-plugins');
	writeFileSync(file, JSON.stringify({ cliPluginsExtraDirs: [plugins] }) + '\n', { mode: 0o600 });
}

/** One duplex byte stream over a child process's stdin and stdout. */
export function childStream(
	command: string,
	args: string[],
	env?: Record<string, string | undefined>
): Duplex {
	const child = spawn(command, args, { env, stdio: ['pipe', 'pipe', 'ignore'] });
	const stream = new Duplex({
		read: () => void child.stdout.resume(),
		write: (chunk, _encoding, done) => void child.stdin.write(chunk, done),
		final: (done) => void child.stdin.end(done),
		destroy: (error, done) => {
			child.kill();
			done(error);
		}
	});
	child.stdout.on('data', (chunk) => {
		if (!stream.push(chunk)) child.stdout.pause();
	});
	child.stdout.once('end', () => stream.push(null));
	child.stdin.on('error', (error) => stream.destroy(error));
	child.once('error', (error) => stream.destroy(error));
	return stream;
}
