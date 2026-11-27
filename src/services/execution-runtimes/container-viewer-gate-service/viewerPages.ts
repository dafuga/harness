// @harness-uid u_dbqtdrtrfx
import { randomBytes } from 'node:crypto';
import type { ServerResponse } from 'node:http';
import type { ViewerDeviceRepository } from '../../../repositories/execution-runtimes/ViewerDeviceRepository';
import type { ViewerAccess } from '../../../repositories/execution-runtimes/ViewerDeviceRepository.types';
import { viewerSessionMs } from '../../../utils/execution-runtimes/createViewerAccess';
import { viewerCookie } from './viewerRequest';

const headers = {
	'cache-control': 'no-store',
	'content-type': 'text/html; charset=utf-8',
	'referrer-policy': 'no-referrer',
	'x-content-type-options': 'nosniff',
	'x-frame-options': 'DENY'
};

/** The only page an unapproved device can see. It shows nothing of the browser. */
export function sendPairingPage(response: ServerResponse, code: string, cookie?: string): void {
	response.writeHead(200, cookie ? { ...headers, 'set-cookie': cookie } : headers);
	response.end(`<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="5"><title>Approve this device</title>
<body style="font-family:system-ui;margin:0;padding:32px 16px;text-align:center">
<h1 style="font-size:20px">Approve this device</h1>
<p style="font-size:44px;letter-spacing:6px;font-variant-numeric:tabular-nums">${code}</p>
<p>Send this code to Harness. This page opens the browser once the code is approved.</p>
</body></html>`);
}

export function sendViewerPairing(
	response: ServerResponse,
	devices: ViewerDeviceRepository,
	access: Exclude<ViewerAccess, { status: 'approved' }>,
	secure: boolean
): void {
	if (access.status === 'pending') {
		sendPairingPage(response, access.code);
		return;
	}
	const { token, code } = devices.request();
	const age = secure ? viewerSessionMs / 1000 : 31_536_000;
	const cookie = `${viewerCookie(secure)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}`;
	sendPairingPage(response, code, secure ? `${cookie}; Secure` : cookie);
}

/** The noVNC frame remains same-origin and keeps control of the remote display. */
export function sendViewerControls(response: ServerResponse): void {
	const nonce = randomBytes(18).toString('base64');
	response.writeHead(200, {
		...headers,
		'content-security-policy':
			`default-src 'none'; frame-src 'self'; connect-src 'self'; frame-ancestors 'none'; ` +
			`form-action 'none'; base-uri 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'`
	});
	response.end(`<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Browser viewer</title>
<style nonce="${nonce}">${viewerStyle}</style>${viewerMarkup}
<script nonce="${nonce}">${viewerScript}</script></html>`);
}

const viewerStyle = `
	:root { color-scheme: light dark; font-family: system-ui, sans-serif }
	body { margin: 0; height: 100dvh; display: grid; grid-template-rows: auto minmax(0, 1fr) }
	header { display: grid; gap: 8px; padding: 12px 16px }
	nav, form, .history { display: flex; gap: 8px; flex-wrap: wrap }
	form { flex: 1 1 240px; min-width: 0 }
	input, button { font: inherit; min-height: 44px; box-sizing: border-box }
	button { padding-inline: 12px; cursor: pointer }
	input { flex: 1; min-width: 0; width: 0; padding-inline: 8px }
	iframe { width: 100%; height: 100%; border: 0 }
	p { margin: 0 }
	p:empty { display: none }
`;

const viewerMarkup = `
<header>
	<nav aria-label="Remote browser navigation">
		<div class="history">
			<button type="button" value="back">Back</button>
			<button type="button" value="forward">Forward</button>
			<button type="button" value="reload">Reload</button>
			<button type="button" value="home">Home</button>
		</div>
		<form>
			<input type="url" aria-label="URL" placeholder="Enter a URL" maxlength="2048"
				autocomplete="off" autocapitalize="off" spellcheck="false" required>
			<button type="submit">Go</button>
		</form>
	</nav>
	<p role="status"></p>
</header>
<iframe title="Remote Chromium" src="/vnc.html?autoconnect=true&amp;reconnect=true&amp;resize=scale&amp;path=websockify"></iframe>
`;

const viewerScript = `
	const field = document.querySelector('input');
	const buttons = document.querySelectorAll('button');
	const status = document.querySelector('p');
	for (const button of document.querySelectorAll('.history button'))
		button.addEventListener('click', () => navigate({ action: button.value }));
	document.querySelector('form').addEventListener('submit', (event) => {
		event.preventDefault();
		void navigate({ action: 'open', url: field.value });
	});
	async function navigate(body) {
		status.textContent = '';
		for (const button of buttons) button.disabled = true;
		try {
			const response = await fetch('/navigate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (response.status !== 204) throw new Error();
			if (body.action === 'open' && field.value === body.url) field.value = '';
		} catch {
			status.textContent = 'Could not navigate. Select the remote page or reopen the viewer, then retry.';
		} finally {
			for (const button of buttons) button.disabled = false;
		}
	}
`;

export function refuse(response: ServerResponse, status: number): void {
	response.writeHead(status, { 'cache-control': 'no-store', 'content-type': 'text/plain' });
	response.end(status === 404 ? 'Not found.' : 'Not allowed.');
}
