// @harness-uid u_7uvhgmunfw
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Duplex } from 'node:stream';
import type {
	ContainerBrowserPipes,
	ContainerBrowserPort,
	ContainerBrowserStatus
} from '../../core/execution-runtimes/containerBrowser.types';
import type { ContainerBrowserConfig, ContainerBrowserHost } from './ContainerBrowserAdapter.types';
import {
	browserImage,
	browserLabel,
	containerBrowserArgs,
	containerBrowserName
} from './container-browser-adapter/containerBrowserArgs';
import { dockerHost } from './container-browser-adapter/dockerHost';

const ports: Record<ContainerBrowserPort, number> = { screen: 5900, devtools: 9222 };

/** A full browser in a local Linux container, on a virtual display nobody's Mac ever shows. */
export class ContainerBrowserAdapter implements ContainerBrowserPipes {
	private readonly name: string;
	private readonly host: ContainerBrowserHost;

	constructor(
		private readonly config: ContainerBrowserConfig,
		host?: ContainerBrowserHost
	) {
		this.name = containerBrowserName(config.profile);
		this.host = host ?? dockerHost();
	}

	/** Builds the image. The download cap is applied inside the image build. */
	async build(directory: string, downloadKbps: number): Promise<void> {
		const cap = `--build-arg=DOWNLOAD_KBPS=${downloadKbps}`;
		await this.host.docker(['build', cap, `--tag=${browserImage}`, directory], 3_600_000);
	}

	/** Starts the browser, or leaves a running one (and its page) untouched. */
	async up(seccompPath: string): Promise<ContainerBrowserStatus> {
		const found = await this.status();
		if (found.running) return found;
		if (found.image) await this.host.docker(['start', this.name]);
		else await this.host.docker(containerBrowserArgs(this.config, seccompPath));
		return this.status();
	}

	async status(): Promise<ContainerBrowserStatus> {
		const filter = `label=${browserLabel}=${this.config.profile}`;
		const format = '{{.Names}}\t{{.State}}\t{{.Image}}';
		const listed = await this.host.docker(['ps', '-a', '--filter', filter, '--format', format]);
		const line = listed.split('\n').find((row) => row.split('\t')[0] === this.name);
		if (!line) return { container: this.name, running: false };
		const [, state, image] = line.split('\t');
		return { container: this.name, running: state === 'running', image };
	}

	/** Stops, then removes, the container. The saved profile volume is kept. */
	async remove(): Promise<void> {
		if (!(await this.status()).image) return;
		await this.host.docker(['stop', '--time=30', this.name], 60_000);
		await this.host.docker(['rm', '--force', this.name]);
	}

	pipe(port: ContainerBrowserPort): Duplex {
		const target = `TCP:127.0.0.1:${ports[port]}`;
		return this.host.stream(['exec', '-i', this.name, 'socat', 'STDIO', target]);
	}

	/** Copies the image's own noVNC client out, following its symlinks. */
	async copyViewerAssets(directory: string): Promise<void> {
		await this.host.docker(['exec', this.name, 'rm', '-rf', '/tmp/viewer']);
		await this.host.docker(['exec', this.name, 'cp', '-rL', '/usr/share/novnc', '/tmp/viewer']);
		await this.host.docker(['cp', `${this.name}:/tmp/viewer/.`, directory]);
		// Debian strips the upstream package.json, but the shipped noVNC client requests it.
		const version = await this.host.docker([
			'exec',
			this.name,
			'dpkg-query',
			'-W',
			'-f=${Version}',
			'novnc'
		]);
		await writeFile(join(directory, 'package.json'), JSON.stringify({ version }), { mode: 0o600 });
	}
}
