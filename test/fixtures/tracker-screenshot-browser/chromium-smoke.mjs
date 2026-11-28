import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const html = `<!doctype html><title>Synthetic form</title>
<form action="/submitted">
  <label for="company" style="position:absolute;left:24px;top:10px">Business name</label>
  <input id="company" name="company" style="position:absolute;left:24px;top:32px;width:200px;height:36px">
  <button style="position:absolute;left:24px;top:96px;width:110px;height:36px">Submit fixture</button>
</form>`;
const chromeUrl = 'http://127.0.0.1:9333';

async function waitFor(condition) {
	const deadline = Date.now() + 8000;
	while (Date.now() < deadline) {
		if (await condition()) return;
		await delay(50);
	}
	throw new Error('Timed out waiting for the synthetic fixture.');
}

async function fixture() {
	let loaded = false;
	let submitted;
	const server = createServer((request, response) => {
		const url = new URL(request.url, 'http://127.0.0.1');
		if (url.pathname === '/submitted') submitted = url.searchParams.get('company');
		if (url.pathname === '/') loaded = true;
		response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
	});
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	return { server, loaded: () => loaded, submitted: () => submitted };
}

async function chromeReady() {
	try {
		const response = await fetch(chromeUrl + '/json/version');
		await response.body?.cancel();
		return response.ok;
	} catch {
		return false;
	}
}

async function tabCount() {
	const tabs = await (await fetch(chromeUrl + '/json/list')).json();
	return tabs.filter((tab) => tab.type === 'page').length;
}

assert.equal(process.platform, 'linux', 'Run the smoke fixture in the isolated headless runner.');
assert.equal(await chromeReady(), false, 'The fixture requires its own Chrome.');
const { openScreenshotBrowser } = await import(process.argv[2]);
const folder = await mkdtemp(join(tmpdir(), 'tracker-screenshot-browser-'));
const { server, loaded, submitted } = await fixture();
const chrome = spawn(
	process.env.CHROMIUM ?? 'chromium',
	[
		'--headless',
		'--no-sandbox',
		'--disable-dev-shm-usage',
		'--disable-background-networking',
		'--remote-debugging-port=9333',
		'--force-device-scale-factor=2',
		`--user-data-dir=${folder}`,
		'about:blank'
	],
	{ stdio: 'ignore' }
);
const exited = once(chrome, 'exit');
try {
	await waitFor(chromeReady);
	assert.equal(await tabCount(), 1);
	const tab = await openScreenshotBrowser(`http://127.0.0.1:${server.address().port}`);
	try {
		await waitFor(loaded);
		assert.equal(await tabCount(), 2);
		const image = await tab.screenshot();
		assert.equal(image.readUInt32BE(0), 0x89504e47);
		assert.ok(image.readUInt32BE(16) > 240);
		await tab.click(42, 48);
		await tab.type('Café fixture');
		await tab.click(75, 109);
		await waitFor(submitted);
		assert.equal(submitted(), 'Café fixture');
	} finally {
		await tab.close();
	}
	await waitFor(async () => (await tabCount()) === 1);
	console.log(
		'Chromium rendered the synthetic form, submitted the clicked and typed value, and kept its original tab.'
	);
} finally {
	chrome.kill();
	await exited;
	server.close();
	await rm(folder, { recursive: true, force: true });
}
