// @harness-uid u_dbqtdrtrfx
import type { ServerResponse } from 'node:http';

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

/** Starts a new navigation from the viewer origin so existing Strict cookies can be sent. */
export function retryViewerNavigation(response: ServerResponse): void {
	response.writeHead(200, headers);
	response.end(`<!doctype html><html lang="en"><meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=/"><title>Open viewer</title>
<a href="/">Open viewer</a></html>`);
}

export function refuse(response: ServerResponse, status: number): void {
	response.writeHead(status, { 'cache-control': 'no-store', 'content-type': 'text/plain' });
	response.end(status === 404 ? 'Not found.' : 'Not allowed.');
}
