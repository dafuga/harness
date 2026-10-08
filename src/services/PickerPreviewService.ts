import type { ProviderSwitchService } from './ProviderSwitchService';
import { pickerMcpTools } from '../utils/pickerMcpTools';

/** Isolated local preview, not a desktop control transport. */
export class PickerPreviewService {
	constructor(
		private readonly service: ProviderSwitchService,
		private readonly html: string | (() => Promise<string>),
		private readonly origin: string
	) {}
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		if (url.origin !== this.origin) return new Response('Host rejected', { status: 403 });
		if (request.method === 'GET' && url.pathname === '/preview')
			return new Response(
				(typeof this.html === 'string' ? this.html : await this.html()).replace(
					'<body>',
					'<body data-picker-preview="true">'
				),
				{
					headers: {
						'Content-Type': 'text/html',
						'Cache-Control': 'no-store',
						'Content-Security-Policy':
							"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'"
					}
				}
			);
		if (request.method !== 'POST' || url.pathname !== '/tools')
			return new Response('Not found', { status: 404 });
		if (request.headers.get('origin') !== this.origin)
			return new Response('Origin rejected', { status: 403 });
		return this.respond(request);
	}

	private async respond(request: Request): Promise<Response> {
		try {
			const body = await request.text();
			if (body.length > 16_000) throw new Error('Request too large');
			const input = JSON.parse(body) as { name: string; arguments?: { session_id?: string } };
			if (input.arguments?.session_id && input.arguments.session_id !== 'preview-session')
				throw new Error('The preview only accepts its synthetic session.');
			const args = { ...input.arguments };
			if (input.name === 'open_model_picker') args.session_id = 'preview-session';
			return Response.json(await pickerMcpTools(this.service, input.name, args));
		} catch {
			return Response.json({ error: 'Invalid preview request.' }, { status: 400 });
		}
	}
}
