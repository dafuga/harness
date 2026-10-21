import type {
	ConsoleSource,
	ConsoleExporter,
	ConsoleHost,
	ConsoleAccess,
	ConsoleData
} from '../../../../../../src/utils/consoleAccess';
import { buildStamp, sdkPackage } from '../../../../../../src/utils/buildStamp';
import {
	consoleCanonical,
	type IndexedHistory
} from '../../../../../../src/utils/console-canonical/consoleCanonical';
import type { ConsolePolicy, ConsoleRequest } from '../../../../../../src/utils/consolePolicy';

const jsonPath = /^(index|activity|revisions\/[0-9a-f]{40}|sides\/[0-9a-f]{40})\.json$/;

const mediaName = /^[0-9a-f]{64}\.[a-z0-9]+$/;

const closed = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };

function refused(status: number, text: string): Response {
	return new Response(text, { status, headers: { ...closed, 'content-type': 'text/plain' } });
}

/**
 * The only way console data leaves the server. Every request is put to the policy first, and a
 * policy that throws denies; a store is opened only for a request that was admitted. Paths are
 * matched against the shapes the index has, so nothing else can be read through these handlers.
 */
export function consoleAccess(options: {
	policy: ConsolePolicy;
	data: ConsoleSource;
	exporter?: ConsoleExporter;
	host?: ConsoleHost;
}): ConsoleAccess {
	const guard = async (event: ConsoleRequest): Promise<Response | undefined> => {
		const allowed = await Promise.resolve()
			.then(() => options.policy(event))
			.catch(() => false);
		return allowed === true ? undefined : refused(403, 'Forbidden');
	};
	const { data: source, exporter } = options;
	const open = (event: ConsoleRequest) => (typeof source === 'function' ? source(event) : source);
	return {
		guard,
		async entry(event, base) {
			return (await guard(event)) ?? redirected(open(event), event.url, base);
		},
		async json(event, path) {
			const answered = path === 'build.json' ? built(options.host) : undefined;
			return (await guard(event)) ?? answered ?? stored(open(event), path);
		},
		async media(event, name) {
			const range = event.request.headers.get('range');
			return (await guard(event)) ?? recorded(open(event), name, range);
		},
		async report(event, commit, record) {
			return (await guard(event)) ?? exported({ data: open(event), exporter }, commit, record);
		}
	};
}

/** Which emitted build, which package and which host revision answered; they may all differ. */
function built(host: ConsoleHost | undefined): Response {
	const body = {
		buildId: buildStamp(host?.build),
		sdk: sdkPackage,
		host: { revision: host?.revision ?? null }
	};
	return new Response(JSON.stringify(body), {
		headers: { ...closed, 'content-type': 'application/json; charset=utf-8' }
	});
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
