import { expect, test, vi } from 'vitest';
import { HostedEvidenceAdapter } from '../../src/adapters/hosted-evidence-adapter/HostedEvidenceAdapter';
import { artifactLimit } from '../../src/utils/artifactMedia';
import { HostedFailureValidator } from '../../src/validators/HostedFailureValidator';

const origin = 'https://hub.example.invalid';
const token = 'fixture-private-token';
const [commit, pinned, hash] = ['a'.repeat(40), 'c'.repeat(40), 'b'.repeat(64)];
const query = {
	projectId: 'p',
	entityId: 'page.home',
	commit,
	branch: 'feature/one two',
	mode: 'current' as const
};
const capture = {
	...query,
	side: 'before' as const,
	recordId: hash,
	scenarioId: 'home-page',
	state: 'filled',
	evidenceId: 'screens',
	viewport: 'desktop' as string | null,
	sha256: hash,
	notesRevision: pinned as string | null,
	evidenceRevision: pinned as string | null
};
const scope = `entityId=page.home&commit=${commit}&branch=feature%2Fone+two&mode=current`;
const bound = `${scope}&side=before&recordId=${hash}&scenarioId=home-page&state=filled&evidenceId=screens&sha256=${hash}`;
const image = { 'content-type': 'image/png' };
type Answer = (url: URL) => Response | Promise<Response>;

/** A client of a hub whose session is good and whose project routes answer as given. */
function hub(answer: Answer) {
	const seen: Array<{ url: string; init: RequestInit | undefined }> = [];
	const onDenied = vi.fn(async () => {});
	const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
		seen.push({ url: String(input), init });
		const url = new URL(String(input));
		if (url.pathname !== '/api/auth/status') return answer(url);
		return Response.json({ actor: { id: 'alice', emailVerified: true } });
	};
	const adapter = new HostedEvidenceAdapter({
		origin,
		credentials: async () => ({ origin, principalId: 'alice', token }),
		fetch: fetcher as typeof fetch,
		onDenied
	});
	return { adapter, seen, onDenied };
}
const failing = (status: number, body: string) => hub(() => new Response(body, { status }));
/** A body of one MiB at a time without end, which counts how often it is asked for more. */
function endless(count: { pulled: number }) {
	const pull = (controller: ReadableStreamDefaultController<Uint8Array>) => {
		count.pulled++;
		controller.enqueue(new Uint8Array(1024 * 1024));
	};
	return new ReadableStream<Uint8Array>({ pull }, { highWaterMark: 0 });
}

test('each read is addressed by exactly the fields of the contract, null ones left out', async () => {
	const { adapter, seen } = hub(() => Response.json({ ok: true }));
	const padded = { ...capture, path: '/etc/passwd', url: 'file:///x', media: 'media/x.png' };
	expect(adapter.path('evidence', padded)).toBe(`/api/projects/p/evidence?${scope}`);
	const pins = `notesRevision=${pinned}&evidenceRevision=${pinned}`;
	expect(adapter.path('artifact', padded)).toBe(
		`/api/projects/p/artifact?${bound}&viewport=desktop&${pins}`
	);
	const unpinned = { ...capture, viewport: null, notesRevision: null, evidenceRevision: null };
	expect(adapter.path('artifact', unpinned)).toBe(`/api/projects/p/artifact?${bound}`);
	expect(adapter.path('artifact', { ...unpinned, evidenceRevision: pinned })).toBe(
		`/api/projects/p/artifact?${bound}&evidenceRevision=${pinned}`
	);
	const refused = [
		{ commit: 'HEAD' },
		{ mode: 'latest' },
		{ side: 'both' },
		{ sha256: 'x' },
		{ recordId: 'latest' },
		{ notesRevision: 'main' },
		{ entityId: '../other' },
		{ projectId: '../other' }
	];
	for (const bad of refused)
		expect(() => adapter.path('artifact', { ...capture, ...bad } as never)).toThrow();
	expect(await adapter.evidence(query)).toEqual({ ok: true });
	const sent = [`${origin}/api/auth/status`, `${origin}/api/projects/p/evidence?${scope}`];
	expect(seen.map((request) => request.url)).toEqual(sent);
	for (const { url, init } of seen) {
		expect(url).not.toContain(token);
		expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${token}`);
		expect([init?.redirect, init?.method, init?.body]).toEqual(['error', undefined, undefined]);
	}
});

test('a capture of more than 11 MiB is refused before it is read, and one of 11 MiB is read whole', async () => {
	const count = { pulled: 0 };
	const length = { ...image, 'content-length': String(artifactLimit + 1) };
	const stated = hub(() => new Response(endless(count), { headers: length }));
	await expect(stated.adapter.artifact(capture)).rejects.toThrow(/11 MiB/);
	expect(count.pulled).toBe(0);
	// Without a stated length the read stops at the first MiB that is past the limit.
	const unstated = hub(() => new Response(endless(count), { headers: image }));
	await expect(unstated.adapter.artifact(capture)).rejects.toThrow(/11 MiB/);
	expect(count.pulled).toBe(12);
	const whole = new Uint8Array(artifactLimit).fill(7);
	const exact = hub(() => new Response(whole, { headers: image }));
	const read = await exact.adapter.artifact(capture);
	expect(read).toMatchObject({ mediaType: 'image/png', principalId: 'alice' });
	expect([read.bytes.length, read.bytes[0], read.bytes.at(-1)]).toEqual([artifactLimit, 7, 7]);
	expect(exact.seen.at(-1)!.url).toBe(
		`${origin}/api/projects/p/artifact?${bound}&viewport=desktop&notesRevision=${pinned}&evidenceRevision=${pinned}`
	);
});

test('a refusal is passed on in the public words of the hub, and a refusal of access is a denial', async () => {
	const said = failing(409, JSON.stringify({ error: 'revision-mismatch' }));
	const refusal = await said.adapter.evidence(query).catch((error: unknown) => error);
	expect(refusal).toBeInstanceOf(HostedFailureValidator);
	expect(refusal).toMatchObject({
		category: 'failed',
		status: 409,
		message: 'The hub refused this read: revision-mismatch.'
	});
	const tooLarge = failing(413, JSON.stringify({ error: 'artifact-too-large' }));
	await expect(tooLarge.adapter.artifact(capture)).rejects.toThrow(
		'The hub refused this read: artifact-too-large.'
	);
	// What is not a public code of the hub is not repeated.
	const unsaid = [
		'<html>private stack</html>',
		JSON.stringify({ error: '<script>x</script>' }),
		JSON.stringify({ error: 7 }),
		JSON.stringify({ error: 'x'.repeat(100_000) }),
		''
	];
	for (const body of unsaid)
		await expect(failing(500, body).adapter.evidence(query)).rejects.toThrow(
			/^The hub refused this read \(500\)\.$/
		);
	for (const [status, project] of [[403, 'p'] as const, [401, undefined] as const]) {
		const denied = failing(status, JSON.stringify({ error: 'forbidden' }));
		await expect(denied.adapter.artifact(capture)).rejects.toMatchObject({
			category: 'denied',
			status
		});
		expect(denied.onDenied).toHaveBeenCalledWith('alice', project);
	}
});

test('a hub that cannot be reached is offline, also when its answer breaks off', async () => {
	const reset = (code: string) => Object.assign(new TypeError('failed'), { cause: { code } });
	const unreachable = hub(() => {
		throw reset('ECONNREFUSED');
	});
	await expect(unreachable.adapter.evidence(query)).rejects.toMatchObject({ category: 'offline' });
	await expect(unreachable.adapter.artifact(capture)).rejects.toMatchObject({
		category: 'offline'
	});
	const broken = () =>
		new ReadableStream<Uint8Array>({ pull: (controller) => controller.error(reset('ECONNRESET')) });
	const cut = hub(() => new Response(broken(), { headers: image }));
	await expect(cut.adapter.artifact(capture)).rejects.toMatchObject({ category: 'offline' });
	await expect(cut.adapter.evidence(query)).rejects.toMatchObject({ category: 'offline' });
});

test('evidence that is not JSON, or more than one answer may be, is refused', async () => {
	for (const body of ['<html>', '', '{"scope":'])
		await expect(hub(() => new Response(body)).adapter.evidence(query)).rejects.toThrow(
			/does not accept/
		);
	const most = 16 * 1024 * 1024;
	const large = hub(() => new Response('{}', { headers: { 'content-length': String(most + 1) } }));
	await expect(large.adapter.evidence(query)).rejects.toThrow(/16 MiB/);
	const count = { pulled: 0 };
	const unstated = hub(() => new Response(endless(count)));
	await expect(unstated.adapter.evidence(query)).rejects.toThrow(/16 MiB/);
	expect(count.pulled).toBe(17);
});
