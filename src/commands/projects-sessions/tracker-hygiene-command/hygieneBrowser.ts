import { basename } from 'node:path';
import { z } from 'zod';
import { beginResource, markResource, saveResource } from './hygieneLedger';
import { waitForHygiene } from './hygieneChild';

const origin = 'http://127.0.0.1:9333';
const browserPath = /^\/devtools\/browser\/([a-f0-9-]{36})$/i;
const targetId = z.string().regex(/^[a-f0-9]{32}$/i);

async function browserIdentity() {
	const response = await fetch(origin + '/json/version', {
		redirect: 'error',
		signal: AbortSignal.timeout(2500)
	});
	if (!response.ok) throw new Error('Automation Chrome is unavailable.');
	const version = z.object({ webSocketDebuggerUrl: z.string() }).parse(await response.json());
	const url = new URL(version.webSocketDebuggerUrl);
	const id = browserPath.exec(url.pathname)?.[1];
	if (!id || url.origin !== 'ws://127.0.0.1:9333')
		throw new Error('Unexpected automation Chrome identity.');
	return z.string().uuid().parse(id);
}

export async function openHygieneBrowser(kind: 'tab' | 'window', address = 'about:blank') {
	const url = new URL(address);
	if (
		(!['http:', 'https:'].includes(url.protocol) && url.href !== 'about:blank') ||
		url.username ||
		url.password
	)
		throw new Error('Use an HTTP(S) URL or about:blank in automation Chrome.');
	const browser = await browserIdentity();
	const entry = beginResource({ kind, browser });
	const blank = 'about:blank#harness-' + basename(entry);
	const response = await browserMessage(browser, 'Target.createTarget', {
		url: blank,
		newWindow: kind === 'window'
	});
	const target = targetId.parse(response.targetId);
	saveResource(entry, { kind, browser, target });
	try {
		if (url.href !== 'about:blank') {
			if (browser !== (await browserIdentity()))
				throw new Error('Automation Chrome identity changed.');
			await browserMessage(browser, 'Page.navigate', { url: url.href }, target);
		}
		return { resource: basename(entry), target };
	} finally {
		markResource(entry, 'ready');
	}
}

export async function closeHygieneBrowser(browser: string, entry: string, target?: string) {
	if (browser !== (await browserIdentity())) throw new Error('Automation Chrome identity changed.');
	const targets = await browserTargets(browser);
	const identity =
		target ?? targets.find(({ url }) => url === 'about:blank#harness-' + basename(entry))?.targetId;
	if (!identity || !targets.some(({ targetId }) => targetId === identity)) return;
	await browserMessage(browser, 'Target.closeTarget', { targetId: identity }).catch(
		() => undefined
	);
	const gone = await waitForHygiene(
		async () => !(await browserTargets(browser)).some(({ targetId }) => targetId === identity),
		2000
	);
	if (!gone) throw new Error('Automation Chrome still reports this target.');
}

async function browserTargets(browser: string) {
	const response = await browserMessage(browser, 'Target.getTargets');
	return z.array(z.object({ targetId, url: z.string() })).parse(response.targetInfos);
}

async function browserMessage(browser: string, method: string, params = {}, target?: string) {
	const socket = new WebSocket(
		'ws://127.0.0.1:9333/devtools/' + (target ? 'page/' + target : 'browser/' + browser)
	);
	try {
		return await new Promise<Record<string, unknown>>((resolve, reject) => {
			const refuse = () => reject(new Error('Automation Chrome did not complete ' + method + '.'));
			const timeout = setTimeout(refuse, 4000);
			const finish = () => clearTimeout(timeout);
			socket.addEventListener('open', () => socket.send(JSON.stringify({ id: 1, method, params })));
			socket.addEventListener('error', () => {
				finish();
				refuse();
			});
			socket.addEventListener('close', () => {
				finish();
				refuse();
			});
			socket.addEventListener('message', (event) => {
				const data = JSON.parse(String(event.data));
				if (data.id !== 1) return;
				finish();
				if (data.error) refuse();
				else resolve(data.result);
			});
		});
	} finally {
		socket.close();
	}
}
