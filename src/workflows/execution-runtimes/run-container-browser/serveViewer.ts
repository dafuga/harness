// @harness-uid u_dcpx5qdkwe
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { ContainerBrowserAdapter } from '../../../adapters/execution-runtimes/ContainerBrowserAdapter';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { ViewerDeviceRepository } from '../../../repositories/execution-runtimes/ViewerDeviceRepository';
import { ContainerViewerGateService } from '../../../services/execution-runtimes/ContainerViewerGateService';
import type { ContainerViewerGateConfig } from '../../../services/execution-runtimes/ContainerViewerGateService.types';
import {
	createViewerAccess,
	viewerSessionMs
} from '../../../utils/execution-runtimes/createViewerAccess';
import type { ContainerBrowserRunInput } from '../runContainerBrowser.types';

const accessFlags = z.object({
	accessHost: z.string().regex(/^[a-z\d-]+(?:\.[a-z\d-]+)+$/u),
	accessTeam: z.string().regex(/^[a-z\d-]+$/u),
	accessAudience: z.string().regex(/^[a-f\d]{64}$/u),
	accessEmail: z.email()
});

/** Serves the viewer until interrupted. */
export async function serveViewer(
	browser: ContainerBrowserAdapter,
	state: string,
	input: ContainerBrowserRunInput
): Promise<void> {
	const remote = remoteAccess(state, input);
	const assets = join(state, 'novnc');
	await mkdir(assets, { recursive: true, mode: 0o700 });
	await browser.copyViewerAssets(assets);
	const gate = new ContainerViewerGateService({
		pipes: browser,
		devices: new ViewerDeviceRepository(state),
		assets,
		hosts: ['127.0.0.1', 'localhost', ...(input.host ?? [])],
		remote
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

function remoteAccess(
	state: string,
	input: ContainerBrowserRunInput
): ContainerViewerGateConfig['remote'] {
	if (![input.accessHost, input.accessTeam, input.accessAudience, input.accessEmail].some(Boolean))
		return undefined;
	const parsed = accessFlags.safeParse(input);
	if (!parsed.success)
		throw new ExpectedCliError(
			'Pass a valid --access-host, --access-team, --access-audience and --access-email together.'
		);
	const { accessHost, accessTeam, accessAudience, accessEmail } = parsed.data;
	return {
		host: accessHost,
		devices: new ViewerDeviceRepository(join(state, 'cloudflare'), Date.now, viewerSessionMs),
		authorize: createViewerAccess(accessTeam, accessAudience, accessEmail)
	};
}
