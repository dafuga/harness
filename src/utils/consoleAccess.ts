import { consoleCanonical, type IndexedHistory } from './consoleCanonical';
import type { ConsolePolicy, ConsoleRequest } from './consolePolicy';

/** Where console data comes from: a directory, or modules bundled into the server. */
export interface ConsoleData {
	/** JSON text of `index.json` or `revisions/<commit>.json`, or undefined when absent. */
	json(path: string): Promise<string | undefined>;
	/** Original bytes of one media file named `<sha256>.<extension>`. */
	media(name: string): Promise<{ bytes: Uint8Array; type: string } | undefined>;
}

/** What a portable report is built from: the stored JSON and a way to read each media file. */
export interface ConsoleExportInput {
	commit: string;
	record: string | null;
	index: string;
	detail: string;
	media: ConsoleData['media'];
}

/** Builds the self-contained report page of one record, or undefined when there is none. */
export type ConsoleExporter = (input: ConsoleExportInput) => Promise<string | undefined>;

export interface ConsoleAccess {
	/** A 403 response when the policy does not admit the request; undefined when it does. */
	guard(event: ConsoleRequest): Promise<Response | undefined>;
	/**
	 * What must be answered before the console document: a refusal, or a redirect from the root
	 * or an earlier query address to the page path it stands for. Undefined for a page path.
	 */
	entry(event: ConsoleRequest, base: string): Promise<Response | undefined>;
	json(event: ConsoleRequest, path: string): Promise<Response>;
	media(event: ConsoleRequest, name: string): Promise<Response>;
	/** One record of a commit as a downloadable page; 404 when the host has no exporter. */
	report(event: ConsoleRequest, commit: string, record: string | null): Promise<Response>;
}

const jsonPath = /^(index|revisions\/[0-9a-f]{40})\.json$/;
const mediaName = /^[0-9a-f]{64}\.[a-z0-9]+$/;
const closed = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };

function refused(status: number, text: string): Response {
	return new Response(text, { status, headers: { ...closed, 'content-type': 'text/plain' } });
}

/**
 * The only way console data leaves the server. Every request is put to the policy first, and a
 * policy that throws denies. Paths are matched against the two shapes the index has, so nothing
 * else can be read through these handlers.
 */
export function consoleAccess(options: {
	policy: ConsolePolicy;
	data: ConsoleData;
	exporter?: ConsoleExporter;
}): ConsoleAccess {
	const guard = async (event: ConsoleRequest): Promise<Response | undefined> => {
		const allowed = await Promise.resolve()
			.then(() => options.policy(event))
			.catch(() => false);
		return allowed === true ? undefined : refused(403, 'Forbidden');
	};
	return {
		guard,
		async entry(event, base) {
			return (await guard(event)) ?? redirected(options.data, event.url, base);
		},
		async json(event, path) {
			return (await guard(event)) ?? stored(options.data, path);
		},
		async media(event, name) {
			const range = event.request.headers.get('range');
			return (await guard(event)) ?? recorded(options.data, name, range);
		},
		async report(event, commit, record) {
			return (await guard(event)) ?? exported(options, commit, record);
		}
	};
}

async function stored(data: ConsoleData, path: string): Promise<Response> {
	const text = jsonPath.test(path) ? await data.json(path) : undefined;
	if (text === undefined) return refused(404, 'Not found');
	return new Response(text, {
		headers: { ...closed, 'content-type': 'application/json; charset=utf-8' }
	});
}

async function recorded(data: ConsoleData, name: string, range: string | null): Promise<Response> {
	const found = mediaName.test(name) ? await data.media(name) : undefined;
	return found ? ranged(found, range) : refused(404, 'Not found');
}

async function redirected(
	data: ConsoleData,
	url: URL,
	base: string
): Promise<Response | undefined> {
	const page = url.pathname.slice(base.length).replace(/\/+$/, '') !== '' && url.search === '';
	const index = page ? undefined : await data.json('index.json');
	const target = index
		? consoleCanonical(JSON.parse(index) as IndexedHistory, url, base)
		: undefined;
	if (!target) return undefined;
	return new Response(null, { status: 308, headers: { ...closed, location: target } });
}

async function exported(
	options: { data: ConsoleData; exporter?: ConsoleExporter },
	commit: string,
	record: string | null
): Promise<Response> {
	const { data, exporter } = options;
	const stored = /^[0-9a-f]{40}$/.test(commit) && exporter;
	const index = stored ? await data.json('index.json') : undefined;
	const detail = stored ? await data.json(`revisions/${commit}.json`) : undefined;
	const media = (name: string) => data.media(name);
	const html =
		exporter && index && detail
			? await exporter({ commit, record, index, detail, media })
			: undefined;
	if (html === undefined) return refused(404, 'Not found');
	return new Response(html, {
		headers: {
			'content-type': 'text/html; charset=utf-8',
			'content-disposition': `attachment; filename="harness-${commit.slice(0, 12)}.html"`,
			'cache-control': 'private, no-store'
		}
	});
}

/** Media is immutable and private: named by its hash, cacheable only by the admin's browser. */
function ranged(found: { bytes: Uint8Array; type: string }, range: string | null): Response {
	const total = found.bytes.byteLength;
	const headers = {
		'content-type': found.type,
		'cache-control': 'private, max-age=31536000, immutable',
		'accept-ranges': 'bytes',
		'x-content-type-options': 'nosniff'
	};
	const asked = /^bytes=(\d*)-(\d*)$/.exec(range ?? '');
	if (!asked || (asked[1] === '' && asked[2] === '')) {
		return new Response(body(found.bytes), {
			headers: { ...headers, 'content-length': String(total) }
		});
	}
	const start = asked[1] === '' ? Math.max(total - Number(asked[2]), 0) : Number(asked[1]);
	const end =
		asked[1] === '' || asked[2] === '' ? total - 1 : Math.min(Number(asked[2]), total - 1);
	if (start > end || start >= total) {
		return new Response(null, { status: 416, headers: { 'content-range': `bytes */${total}` } });
	}
	return new Response(body(found.bytes.slice(start, end + 1)), {
		status: 206,
		headers: {
			...headers,
			'content-range': `bytes ${start}-${end}/${total}`,
			'content-length': String(end - start + 1)
		}
	});
}

/** A copy in its own buffer, which every runtime accepts as a response body. */
function body(bytes: Uint8Array): ArrayBuffer {
	const copy = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(copy).set(bytes);
	return copy;
}
