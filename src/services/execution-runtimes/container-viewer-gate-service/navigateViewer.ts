// @harness-uid u_z44opi3qpo
import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import type { ContainerCdpAdapter } from '../../../adapters/execution-runtimes/ContainerCdpAdapter';
import { refuse } from './viewerPages';

const command = z.discriminatedUnion('action', [
	z.strictObject({ action: z.enum(['back', 'forward', 'reload', 'home']) }),
	z.strictObject({ action: z.literal('open'), url: z.string().max(2048) })
]);

/** Only the four toolbar commands and HTTP(S) addresses go over the DevTools pipe. */
export async function navigateViewer(
	request: IncomingMessage,
	response: ServerResponse,
	browser: ContainerCdpAdapter
): Promise<void> {
	const input = await readCommand(request);
	if (!input) return refuse(response, 400);
	if (input.action === 'open') {
		const url = URL.parse(input.url);
		if (!url || !['https:', 'http:'].includes(url.protocol) || url.username || url.password)
			return refuse(response, 400);
		await browser.navigateFocused('open', url.href);
	} else if (input.action === 'home') await browser.navigateFocused('open', 'about:blank');
	else await browser.navigateFocused(input.action, '');
	response.writeHead(204, { 'cache-control': 'no-store' }).end();
}

async function readCommand(request: IncomingMessage) {
	if (request.headers['content-type'] !== 'application/json') return;
	try {
		let body = '';
		request.setEncoding('utf8');
		for await (const chunk of request.iterator({ destroyOnReturn: false })) {
			body += chunk as string;
			if (body.length > 4096) return;
		}
		return command.safeParse(JSON.parse(body)).data;
	} catch {
		return undefined;
	}
}
// @harness-uid u_z3okqfjr2m
