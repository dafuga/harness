import type { ExplorerArtifact, ExplorerArtifactBehavior } from '../models/Explorer.types';
import type { HarnessCapture } from '../models/Harness.types';
import { mediaFile } from './harnessEvidence';

type Fields = Record<string, unknown>;
/** The names a run may give what it was asked and what it answered; the first one found is read. */
const asked = ['input', 'inputs', 'request'];
const answered = ['output', 'outputs', 'response', 'actual'];
const read = ['scenario', 'environment', 'fixture', 'steps', 'assertions', 'trace'];
const unread: ExplorerArtifact = {
	verified: false,
	problem: null,
	text: '',
	document: null,
	behavior: null
};

const text = (value: unknown) => (typeof value === 'string' ? value : null);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const named = ['name', 'title', 'id', 'passed', 'status'];
type Assertion = ExplorerArtifactBehavior['assertions'][number];

/** One assertion as it was recorded: a sentence, or a name with whether it held and what else. */
function assertion(item: unknown): Assertion {
	if (typeof item !== 'object' || item === null) return { name: String(item), passed: null };
	const fields = item as Fields;
	const name = text(fields.name) ?? text(fields.title) ?? text(fields.id) ?? 'Unnamed assertion';
	const stated = { passed: true, failed: false }[String(fields.status)] ?? null;
	const passed = typeof fields.passed === 'boolean' ? fields.passed : stated;
	const rest = Object.entries(fields).filter(([key]) => !named.includes(key));
	return rest.length > 0 ? { name, passed, detail: Object.fromEntries(rest) } : { name, passed };
}

/** What a recorded value reads as: a sentence as it is, anything structured as indented JSON. */
export function artifactText(value: unknown): string {
	if (value === undefined) return 'Not recorded';
	return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

/**
 * What a recorded run states about itself, read from the fields it has: its scenario,
 * environment and fixture, its steps, what it was asked and what it answered, its assertions and
 * its trace. A step, a request or an answer that is structured stays structured. A field the
 * artifact does not have is absent or empty; every other field is kept as it was recorded. Null for a document that is not an object.
 */
export function artifactBehavior(document: unknown): ExplorerArtifactBehavior | null {
	if (typeof document !== 'object' || document === null || Array.isArray(document)) return null;
	const fields = document as Fields;
	const input = asked.find((name) => name in fields);
	const output = answered.find((name) => name in fields);
	const known = [...read, input, output];
	return {
		scenario: text(fields.scenario),
		environment: text(fields.environment),
		fixture: text(fields.fixture),
		steps: list(fields.steps),
		...(input ? { input: fields[input] } : {}),
		...(output ? { output: fields[output] } : {}),
		assertions: list(fields.assertions).map(assertion),
		trace: list(fields.trace),
		other: Object.fromEntries(Object.entries(fields).filter(([name]) => !known.includes(name)))
	};
}

/** What reads the bytes at an address; the browser's fetch, unless a caller gives another. */
export type ArtifactFetcher = (
	address: string
) => Promise<Pick<Response, 'ok' | 'status' | 'arrayBuffer'>>;

async function sha256(bytes: ArrayBuffer): Promise<string> {
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
	return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function parsed(body: string): unknown {
	try {
		return JSON.parse(body) as unknown;
	} catch {
		return null;
	}
}

/**
 * The bytes of one recorded artifact, read from the protected media path of the console and
 * checked against the SHA-256 its capture states. Bytes with another hash are shown as
 * unverified and nothing is read from them; an artifact that is not stored says why.
 */
export async function explorerArtifact(
	capture: HarnessCapture,
	mediaBase: string,
	fetcher: ArtifactFetcher = (address) => fetch(address)
): Promise<ExplorerArtifact> {
	if (capture.media === null) {
		return { ...unread, problem: capture.gap ?? 'The artifact is not stored.' };
	}
	const response = await fetcher(mediaBase + mediaFile(capture));
	if (!response.ok) {
		return { ...unread, problem: `The artifact could not be read (${response.status}).` };
	}
	const bytes = await response.arrayBuffer();
	const body = new TextDecoder().decode(bytes);
	if ((await sha256(bytes)) !== capture.sha256) {
		const problem = 'The bytes that were read do not have the recorded SHA-256.';
		return { ...unread, problem, text: body };
	}
	const document = parsed(body);
	return {
		verified: true,
		problem: null,
		text: body,
		document,
		behavior: artifactBehavior(document)
	};
}
