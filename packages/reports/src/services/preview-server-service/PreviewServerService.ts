import { createServer, type Server } from 'node:http';
import { previewOwner } from './previewOwner';
import { previewOwnerPath, previewOwnerPort } from '../../utils/previewOwner';
import type { PreviewOwner } from '../../utils/previewOwner';

export interface PreviewHandle {
	url: string;
	close(): Promise<void>;
}

export interface PreviewResult {
	url: string;
	reused: boolean;
}

/** One OS-owned slot shared by all Harness dev entrypoints, even simultaneous processes. */
export class PreviewServerService {
	private server: Server | null = null;
	private preview: PreviewHandle | null = null;
	private starting: Promise<PreviewResult> | null = null;
	private closing: Promise<void> | null = null;
	constructor(private readonly port: number = previewOwnerPort) {}

	run(identity: string, start: () => Promise<PreviewHandle>): Promise<PreviewResult> {
		this.starting ??= this.acquire(identity, start);
		return this.starting;
	}
	/** Closing a reuser never closes the actual owner's server. No PID is signalled. */
	close(): Promise<void> {
		this.closing ??= this.release();
		return this.closing;
	}
	private async acquire(
		identity: string,
		start: () => Promise<PreviewHandle>
	): Promise<PreviewResult> {
		const owner: PreviewOwner = {
			protocol: 'harness-preview-v1',
			identity,
			url: null,
			pid: process.pid
		};
		const server = createServer((request, response) => {
			if (request.method !== 'GET' || request.url !== previewOwnerPath) {
				response.writeHead(404).end();
				return;
			}
			response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
			response.end(JSON.stringify(owner));
		});
		try {
			await this.listen(server);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error;
			return { url: await previewOwner(this.port, identity), reused: true };
		}
		this.server = server;
		try {
			this.preview = await start();
			owner.url = this.preview.url;
			return { url: owner.url, reused: false };
		} catch (error) {
			await this.closeServer();
			throw error;
		}
	}
	private listen(server: Server): Promise<void> {
		return new Promise((resolve, reject) => {
			server.once('error', reject);
			server.listen(this.port, '127.0.0.1', () => {
				server.removeListener('error', reject);
				resolve();
			});
		});
	}
	private async release(): Promise<void> {
		await this.starting?.catch(() => undefined);
		try {
			await this.preview?.close();
		} finally {
			await this.closeServer();
		}
	}
	private async closeServer(): Promise<void> {
		const server = this.server;
		this.server = null;
		if (!server) return;
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
}
