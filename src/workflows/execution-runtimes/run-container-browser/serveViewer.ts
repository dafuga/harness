// @harness-uid u_dcpx5qdkwe
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ContainerBrowserAdapter } from '../../../adapters/execution-runtimes/ContainerBrowserAdapter';
import { ViewerDeviceRepository } from '../../../repositories/execution-runtimes/ViewerDeviceRepository';
import { ContainerViewerGateService } from '../../../services/execution-runtimes/ContainerViewerGateService';
import type { ContainerBrowserRunInput } from '../runContainerBrowser.types';

/** Serves the viewer until interrupted. */
export async function serveViewer(
	browser: ContainerBrowserAdapter,
	state: string,
	input: ContainerBrowserRunInput
): Promise<void> {
	const assets = join(state, 'novnc');
	await mkdir(assets, { recursive: true, mode: 0o700 });
	await browser.copyViewerAssets(assets);
	const gate = new ContainerViewerGateService({
		pipes: browser,
		devices: new ViewerDeviceRepository(state),
		assets,
		hosts: ['127.0.0.1', 'localhost', ...(input.host ?? [])]
	});
	const port = await gate.listen(input.port);
	console.log(`Viewer on loopback port ${port}.`);
	const stop = new AbortController();
	const interrupt = () => stop.abort();
	process.once('SIGINT', interrupt);
	process.once('SIGTERM', interrupt);
	input.signal?.addEventListener('abort', interrupt);
	if (!input.signal?.aborted) await once(stop.signal, 'abort');
	await gate.close();
}
