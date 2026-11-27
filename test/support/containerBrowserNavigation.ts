import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect, type Page } from '@playwright/test';
import type { ContainerBrowserAdapter } from '../../src/adapters/execution-runtimes/ContainerBrowserAdapter';
import { ContainerCdpAdapter } from '../../src/adapters/execution-runtimes/ContainerCdpAdapter';
import { dockerHost } from '../../src/adapters/execution-runtimes/container-browser-adapter/dockerHost';
import { pipeWebSocket } from '../../src/adapters/execution-runtimes/container-cdp-adapter/pipeWebSocket';
import { ViewerDeviceRepository } from '../../src/repositories/execution-runtimes/ViewerDeviceRepository';
import { ContainerViewerGateService } from '../../src/services/execution-runtimes/ContainerViewerGateService';
import { browserErrorCollector } from './browserTest';

const url = 'http://127.0.0.1:18703';
const sizes = { desktop: [1440, 900], tablet: [768, 1024], phone: [390, 844] } as const;

/** Drives the real paired viewer and a headed Chromium popup in a disposable profile. */
export async function checkContainerViewer(browser: ContainerBrowserAdapter, profile: string) {
	const directory = await mkdtemp(join(tmpdir(), 'container-viewer-e2e-'));
	const cdp = new ContainerCdpAdapter(browser);
	const [parent] = await cdp.pages();
	const devices = new ViewerDeviceRepository(join(directory, 'devices'));
	const assets = join(directory, 'assets');
	const gate = new ContainerViewerGateService({
		pipes: browser,
		devices,
		assets,
		hosts: ['127.0.0.1']
	});
	const errors = browserErrorCollector('chromium');
	const client = await chromium.launch({ headless: true });
	try {
		await browser.copyViewerAssets(assets);
		await startFixtureSite(profile);
		await openPopup(browser, parent.id);
		const popup = await findPopup(cdp, parent.id);
		const original = await cdp.attach(parent);
		const port = await gate.listen(0);
		try {
			await popup.navigate(`${url}/second`);
			const context = await client.newContext();
			errors.watch(context);
			const viewer = await context.newPage();
			await pairViewer(viewer, devices, port);
			await capture(viewer);
			await clickNavigation(viewer, popup, 'Back', '/first');
			await clickNavigation(viewer, popup, 'Forward', '/second');
			await popup.evaluate('window.fixtureMarker = true');
			await viewer.getByRole('button', { name: 'Reload' }).click();
			await expect.poll(() => popup.evaluate('Boolean(window.fixtureMarker)')).toBe(false);
			await clickNavigation(viewer, popup, 'Home', 'about:blank');
			await viewer.getByRole('textbox', { name: 'URL' }).fill(`${url}/third`);
			await viewer.getByRole('textbox', { name: 'URL' }).press('Enter');
			await expect.poll(() => popup.evaluate('location.pathname')).toBe('/third');
			await expect(viewer.getByRole('textbox', { name: 'URL' })).toHaveValue('');
			await expect(viewer).toHaveURL(`http://127.0.0.1:${port}/viewer`);
			expect(await original.evaluate('location.href')).toBe('about:blank');
		} finally {
			popup.close();
			original.close();
		}
	} finally {
		await client.close();
		await gate.close().catch(() => undefined);
		await rm(directory, { recursive: true, force: true });
		await errors.finish();
	}
	return 'Back, Forward, Reload, Home and URL acted on the popup';
}

async function pairViewer(viewer: Page, devices: ViewerDeviceRepository, port: number) {
	await viewer.goto(`http://127.0.0.1:${port}/`);
	const code = await viewer.getByText(/^\d{6}$/u).innerText();
	expect(devices.approve(code)).toBe(true);
	await viewer.reload();
}

async function capture(viewer: Page) {
	const frame = viewer.url().includes('/viewer')
		? viewer.frameLocator('iframe[title="Remote Chromium"]')
		: viewer;
	await expect(frame.locator('html.noVNC_connected canvas')).toBeVisible({ timeout: 15_000 });
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	await viewer.evaluate(() => document.fonts.ready.then(() => undefined));
	const directory = process.env.SCREENSHOT_DIR ?? 'test-results/container-viewer';
	for (const [name, [width, height]] of Object.entries(sizes)) {
		await viewer.setViewportSize({ width, height });
		await viewer.evaluate(
			() =>
				new Promise<void>((ready) =>
					requestAnimationFrame(() => requestAnimationFrame(() => ready()))
				)
		);
		await viewer.screenshot({
			path: join(directory, `container-viewer-${name}.png`),
			animations: 'disabled'
		});
	}
}

async function clickNavigation(
	viewer: Page,
	popup: Awaited<ReturnType<ContainerCdpAdapter['attach']>>,
	button: string,
	path: string
) {
	await viewer.getByRole('button', { name: button, exact: true }).click({ timeout: 5000 });
	await expect
		.poll(() => popup.evaluate(path === 'about:blank' ? 'location.href' : 'location.pathname'))
		.toBe(path);
}

async function startFixtureSite(profile: string) {
	const name = `harness-browser-${profile}`;
	const file = '/tmp/container-viewer-fixture';
	const site = `<!doctype html><title>Sign-in popup fixture</title><h1>Sign-in popup fixture</h1>`;
	const script = `#!/bin/sh
while IFS= read -r line; do
	[ "$line" = "$(printf '\\r')" ] && break
done
printf 'HTTP/1.1 200 OK\\r\\nContent-Type: text/html\\r\\nContent-Length: ${site.length}\\r\\nConnection: close\\r\\n\\r\\n%s' '${site}'
`;
	const docker = dockerHost();
	await docker.docker([
		'exec',
		name,
		'sh',
		'-c',
		'printf "%s" "$1" > "$2" && chmod 700 "$2"',
		'fixture',
		script,
		file
	]);
	await docker.docker([
		'exec',
		'-d',
		name,
		'socat',
		'TCP4-LISTEN:18703,bind=127.0.0.1,reuseaddr,fork',
		`EXEC:${file}`
	]);
}

async function openPopup(browser: ContainerBrowserAdapter, target: string) {
	const stream = browser.pipe('devtools');
	try {
		await new Promise<void>((resolve, reject) => {
			void pipeWebSocket(stream, `/devtools/page/${target}`, {
				message: (text) => {
					const reply = JSON.parse(text) as { result?: { result?: { value?: boolean } } };
					if (reply.result?.result?.value === true) resolve();
					else reject(new Error('The synthetic Chromium popup did not open.'));
				},
				close: () => reject(new Error('The fixture DevTools pipe closed.'))
			}).then((socket) => {
				socket.send(
					JSON.stringify({
						id: 1,
						method: 'Runtime.evaluate',
						params: {
							expression: `Boolean(window.open('${url}/first', 'viewer-test', 'popup,width=440,height=640'))`,
							userGesture: true,
							returnByValue: true
						}
					})
				);
			}, reject);
		});
	} finally {
		const closed = once(stream, 'close');
		stream.destroy();
		await closed.catch(() => undefined);
	}
}

async function findPopup(cdp: ContainerCdpAdapter, parent: string) {
	const targets = await cdp.pages();
	const found = targets.find((target) => target.id !== parent);
	if (!found) throw new Error('The fixture popup is missing.');
	const popup = await cdp.attach(found);
	await expect.poll(() => popup.evaluate('document.hasFocus()')).toBe(true);
	return popup;
}
