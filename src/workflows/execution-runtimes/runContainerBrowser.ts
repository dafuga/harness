// @harness-uid u_d22gcywhzl
import { setTimeout as delay } from 'node:timers/promises';
import { ContainerBrowserAdapter } from '../../adapters/execution-runtimes/ContainerBrowserAdapter';
import { ContainerCdpAdapter } from '../../adapters/execution-runtimes/ContainerCdpAdapter';
import { ensureColima } from '../../adapters/execution-runtimes/container-browser-adapter/colimaRuntime';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import { ViewerDeviceRepository } from '../../repositories/execution-runtimes/ViewerDeviceRepository';
import type { ContainerBrowserRunInput } from './runContainerBrowser.types';
import {
	containerBrowserSources,
	containerBrowserState
} from './run-container-browser/containerBrowserPaths';
import { serveViewer } from './run-container-browser/serveViewer';

export async function runContainerBrowser(input: ContainerBrowserRunInput): Promise<number> {
	const state = containerBrowserState(input.profile, input.directory);
	if (input.action === 'approve') return approve(state, input.value);
	if (input.action === 'revoke') {
		new ViewerDeviceRepository(state).revokeAll();
		console.log('Every viewer device was removed.');
		return 0;
	}
	const browser = new ContainerBrowserAdapter({ profile: input.profile });
	if (input.action === 'setup') {
		await ensureColima({ diskImage: input.diskImage });
		await browser.build(containerBrowserSources().image, input.downloadKbps);
		console.log('Built the container browser image.');
		return 0;
	}
	if (input.action === 'down') await down(browser);
	else if (input.action !== 'status') {
		await ensureColima({ diskImage: input.diskImage });
		await browser.up(containerBrowserSources().seccomp);
	}
	if (input.action === 'open') await open(browser, state, input.value);
	if (input.action === 'viewer') await serveViewer(browser, state, input);
	else {
		const viewers = new ViewerDeviceRepository(state).counts();
		console.log(JSON.stringify({ ...(await browser.status()), viewers }));
	}
	return 0;
}

/** The browser is asked to quit first, so a fresh sign-in is saved. */
async function down(browser: ContainerBrowserAdapter): Promise<void> {
	if ((await browser.status()).running) {
		await new ContainerCdpAdapter(browser).quit().catch(() => undefined);
		await delay(3000);
	}
	await browser.remove();
}

function approve(state: string, code: string | undefined): number {
	if (!code || !new ViewerDeviceRepository(state).approve(code))
		throw new ExpectedCliError('No waiting device shows that code. Reload the viewer for one.');
	console.log('Approved. The device showing that code can now watch and control the browser.');
	return 0;
}

/** Points the first tab at an address, for example a site's sign-in page. */
async function open(
	browser: ContainerBrowserAdapter,
	state: string,
	address: string | undefined
): Promise<void> {
	if (!address || URL.parse(address)?.protocol !== 'https:')
		throw new ExpectedCliError('Pass an https address to open.');
	if (new ViewerDeviceRepository(state).attended())
		throw new ExpectedCliError('Someone is using the viewer; the page was left alone.');
	const cdp = new ContainerCdpAdapter(browser);
	const [target] = await cdp.pages();
	if (!target) throw new ExpectedCliError('The container browser has no open tab.');
	const page = await cdp.attach(target);
	try {
		await page.navigate(address);
	} finally {
		page.close();
	}
}
