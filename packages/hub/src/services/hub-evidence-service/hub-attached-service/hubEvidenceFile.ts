import { evidenceFileLimit } from '../../../utils/hubEvidenceFile';
import { createHash } from 'node:crypto';
import type { EvidenceFile, EvidencePointer } from '../../../../../../src/core/historyTypes';
import type { HubSourceContext } from '../../../utils/hubSource';
import { hubMaterializedHash } from '../../../utils/hubRaw';
import { hubFail } from '../../../utils/hubJson';

type Input = { pointer: EvidencePointer; file: EvidenceFile };

/** What one declared file turned out to be: its bytes and frozen fact only when intact. */
interface Checked {
	bytes?: Uint8Array;
	problems: string[];
	fact?: Readonly<EvidenceFile & { blob: string }>;
}

/** Exactly one declared file at a time. Neither the byte cache nor source memo retains it. */
export async function hubEvidenceFile(base: HubSourceContext, input: Input) {
	const source = base;
	const path = `${input.pointer.path}/${input.file.path}`;
	if (input.file.bytes > evidenceFileLimit) return hubFail('evidence-file-too-large');
	try {
		return await read(source, input, path);
	} finally {
		source.source.releaseBytes?.(source.repository, {
			commit: source.commit,
			path
		});
	}
}

/** The bytes are the declared ones: the same length and the same sha256. */
function declared(bytes: Uint8Array, file: EvidenceFile): boolean {
	return (
		bytes.length === file.bytes && createHash('sha256').update(bytes).digest('hex') === file.sha256
	);
}

/**
 * The object an LFS pointer names, or the problem when the pointer states other content than
 * the record declares. An object that is not what its pointer states is a failure of the read.
 */
async function materialized(
	source: HubSourceContext,
	input: Input,
	raw: Uint8Array
): Promise<Uint8Array | string> {
	const { file } = input;
	const path = `${input.pointer.path}/${file.path}`;
	const stated = await hubMaterializedHash(raw, null);
	if (!stated.lfs || stated.hash !== file.sha256 || stated.size !== file.bytes)
		return `${file.path} does not match its manifest`;
	const bytes = await source.source.read(source.repository, { commit: source.commit, path });
	return declared(bytes, file) ? bytes : hubFail('cache-hash-mismatch');
}

async function read(source: HubSourceContext, input: Input, path: string): Promise<Checked> {
	const { file } = input;
	const stored = await storedFile(source, path);
	if (!stored) return { problems: [`${file.path} is missing from the evidence branch`] };
	const lfs = file.storage === 'lfs';
	const held = lfs ? await materialized(source, input, stored.raw) : stored.raw;
	if (typeof held === 'string') return { problems: [held] };
	const intact = declared(held, file);
	const message = lfs
		? `media ${file.path} does not match its recorded hash`
		: `${file.path} does not match its manifest`;
	return {
		bytes: held,
		problems: intact ? [] : [message],
		fact: intact ? Object.freeze({ ...file, blob: stored.entry.sha }) : undefined
	};
}

async function storedFile(source: HubSourceContext, path: string) {
	const entry = source.entries.find(
		(e) => e.path === path && e.type === 'blob' && ['100644', '100755'].includes(e.mode)
	);
	if (!entry) return null;
	if ((entry.size ?? 0) > evidenceFileLimit) return hubFail('evidence-file-too-large');
	const raw = await source.source.raw(source.repository, {
		commit: source.commit,
		path
	});
	const blob = createHash('sha1').update(`blob ${raw.length}\0`).update(raw).digest('hex');
	if (blob !== entry.sha) return hubFail();
	if (raw.length > evidenceFileLimit) return hubFail('evidence-file-too-large');
	return { entry, raw };
}
