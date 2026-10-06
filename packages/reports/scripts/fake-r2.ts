const objects = new Map<string, { bytes: Uint8Array; mime: string }>();

Bun.serve({
	hostname: '127.0.0.1',
	port: Number(process.env.PROJECT_REPORTS_E2E_R2_PORT || 5590),
	async fetch(request) {
		const path = new URL(request.url).pathname;
		if (path === '/health') return new Response('ok');
		if (request.method === 'PUT') {
			objects.set(path, {
				bytes: new Uint8Array(await request.arrayBuffer()),
				mime: request.headers.get('content-type') || 'application/octet-stream'
			});
			return new Response(null, { status: 200, headers: { ETag: '"test-object"' } });
		}
		const object = objects.get(path);
		if (request.method === 'GET' && object)
			return new Response(object.bytes, { headers: { 'Content-Type': object.mime } });
		return new Response('not found', { status: 404 });
	}
});
