// @harness-uid u_bjzxwihuau
import { ExpectedCliError } from '../../core/development-tooling/errors';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { isAbsolute } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import type { DockerTaskDaemon } from '../agents-providers/ManagedProviderDockerAdapter.types';
import {
	createContainer,
	dockerArgs,
	dockerControl,
	dockerDaemon,
	requireDaemon,
	requireWorkspaceImage
} from '../agents-providers/managed-provider-docker-adapter/dockerControl';
import {
	browserDockerArgs,
	browserDockerEgress,
	requireInternalNetwork,
	validateFixtureNetwork
} from './vault-browser-docker-adapter/browserDockerConfig';
import {
	newBrowserReceipt,
	privateJournal,
	recoverBrowserFixtures,
	removeBrowserFixture,
	saveBrowserReceipt,
	vaultDockerImage
} from './vault-browser-docker-adapter/browserDockerJournal';
import type {
	VaultBrowserDockerAdapterConfig,
	VaultBrowserDockerLaunch,
	VaultBrowserDockerSession
} from './VaultBrowserDockerAdapter.types';

/** Launches only an isolated synthetic browser fixture through a local Docker Unix socket. */
export class VaultBrowserDockerAdapter {
	constructor(private readonly config: VaultBrowserDockerAdapterConfig) {
		if (!vaultDockerImage.test(config.image))
			throw new ExpectedCliError('Use a full local image ID for Vault.');
		if (!isAbsolute(config.seccomp) || !isAbsolute(config.journal)) {
			throw new ExpectedCliError('Vault Docker seccomp and journal paths must be absolute.');
		}
	}

	async launch(input: VaultBrowserDockerLaunch): Promise<VaultBrowserDockerSession> {
		const { image, journal } = this.config;
		const egress = browserDockerEgress(input.origins, input.redirects);
		if (input.network) validateFixtureNetwork(input.network, egress.proxyHosts);
		const daemon = await dockerDaemon(this.config.context);
		if (input.network) await requireInternalNetwork(daemon, input.network.id);
		await requireWorkspaceImage(daemon, image);
		await privateJournal(journal);
		await recoverBrowserFixtures(journal, daemon);
		const receipt = newBrowserReceipt(daemon, image);
		await saveBrowserReceipt(journal, receipt);
		let removal: Promise<void> | undefined;
		const close = () =>
			(removal ??= removeBrowserFixture(journal, daemon, receipt).catch((error) => {
				removal = undefined;
				throw error;
			}));
		try {
			const args = browserDockerArgs(this.config, receipt.owner, egress, input.network);
			const id = await createContainer(daemon, args);
			receipt.container = id;
			await saveBrowserReceipt(journal, receipt);
			await requireDaemon(daemon);
			await dockerControl(daemon, ['start', id]);
			await waitForPipe(daemon, id);
			return await attachPipe(daemon, id, receipt.owner, close);
		} catch (error) {
			await close();
			throw error;
		}
	}
}

async function waitForPipe(daemon: DockerTaskDaemon, id: string): Promise<void> {
	const inspect = ['inspect', '--format', '{{.State.Running}}', id];
	const check = ['exec', '-u', '10001:10001', id, '/usr/bin/test', '-S', '/work/cdp.sock'];
	const deadline = Date.now() + 10_000;
	while (Date.now() < deadline) {
		if ((await dockerControl(daemon, inspect)) !== 'true') break;
		if (
			await dockerControl(daemon, check).then(
				() => true,
				() => false
			)
		)
			return;
		await setTimeout(100);
	}
	throw new ExpectedCliError('The Vault guest did not start its private Chromium pipe.');
}

async function attachPipe(
	daemon: DockerTaskDaemon,
	id: string,
	owner: string,
	remove: () => Promise<void>
): Promise<VaultBrowserDockerSession> {
	await requireDaemon(daemon);
	const command = [
		'exec',
		'-i',
		'-u',
		'10001:10001',
		id,
		'/usr/bin/python3',
		'/opt/vault/pipe_client.py'
	];
	const child = spawn('docker', dockerArgs(daemon, command), {
		env: daemon.env,
		stdio: ['pipe', 'pipe', 'ignore']
	});
	await once(child, 'spawn');
	// Docker logs are never piped into the session. The only output is the private CDP stream.
	child.stdin.on('error', () => child.stdout.destroy());
	return {
		owner,
		pipe: { readable: child.stdout, writable: child.stdin },
		close: async () => {
			try {
				await remove();
			} finally {
				child.stdin.destroy();
				child.stdout.destroy();
				child.kill();
			}
		}
	};
}
