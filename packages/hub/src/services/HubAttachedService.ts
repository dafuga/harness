import {
	evidenceManifestSchema,
	evidencePointerSchema,
	type EvidencePointer
} from '../../../../src/core/historyTypes';
import { artifactLimit } from '../../../desktop/src/utils/artifactMedia';
import { hubEvidenceFile } from '../utils/hubEvidenceFile';
import { hubFail, hubHash } from '../utils/hubJson';
import { hubRaw } from '../utils/hubRaw';
import type { HubSourceContext } from '../utils/hubSource';
import { hubEvidencePath, hubPinnedSource } from '../utils/hubPinnedSource';
import {
	hubAttachedRecord,
	hubRecordJson,
	type HubAttachedRecord
} from '../utils/hubAttachedRecord';

interface Context {
	base: HubSourceContext;
	within: string | null;
	reaches: (tip: string, commit: string) => Promise<boolean>;
}
/** All file hashes, sizes, seal and manifest identity are checked, including unselected captures. */
export class HubAttachedService {
	private readonly loaded = new Map<string, Promise<HubAttachedRecord>>();
	private sequential: Promise<void> = Promise.resolve();
	constructor(private readonly context: Context) {}
	load(pointer: EvidencePointer): Promise<HubAttachedRecord> {
		const held = Object.freeze({ ...pointer });
		const key = JSON.stringify(held);
		const pending = this.loaded.get(key) ?? this.queue(() => this.read(held));
		this.loaded.set(key, pending);
		return pending;
	}
	private queue<T>(read: () => Promise<T>): Promise<T> {
		const pending = this.sequential.then(read);
		this.sequential = pending.then(
			() => undefined,
			() => undefined
		);
		return pending;
	}

	private async read(pointer: EvidencePointer): Promise<HubAttachedRecord> {
		const result: HubAttachedRecord = {
			pointer: Object.freeze({ ...pointer }),
			files: new Map(),
			facts: new Map(),
			problems: []
		};
		if (
			!evidencePointerSchema.safeParse(pointer).success ||
			!hubEvidencePath(pointer.path) ||
			!pointer.path.startsWith('records/')
		)
			return { ...result, problems: ['evidence pointer is not valid'] };
		const { within, reaches, base } = this.context;
		if (!within || !(await reaches(within, pointer.commit)))
			return {
				...result,
				problems: [
					`evidence commit ${pointer.commit.slice(0, 12)} is not part of the pinned evidence`
				]
			};
		const source = await hubPinnedSource(base, pointer.commit);
		const entry = source.entries.find(
			(e) =>
				e.path === `${pointer.path}/manifest.json` &&
				e.type === 'blob' &&
				['100644', '100755'].includes(e.mode)
		);
		const bytes = entry ? await hubRaw(source, entry) : undefined;
		if (!bytes || (await hubHash(bytes)) !== pointer.manifest)
			return { ...result, problems: ['manifest does not match the hash in the note'] };
		return this.manifest(result, source, bytes);
	}
	private async manifest(
		result: HubAttachedRecord,
		source: HubSourceContext,
		bytes: Uint8Array
	): Promise<HubAttachedRecord> {
		const { pointer } = result;
		const manifest = evidenceManifestSchema.safeParse(hubRecordJson(bytes));
		if (!manifest.success) return { ...result, problems: ['manifest is not valid'] };
		const paths = manifest.data.files.map((file) => file.path);
		if (
			new Set(paths).size !== paths.length ||
			!paths.includes('record.json') ||
			!paths.every(hubEvidencePath)
		)
			return { ...result, problems: ['manifest file paths are not valid'] };
		result.manifest = manifest.data;
		for (const file of manifest.data.files) {
			const checked = await hubEvidenceFile(source, { pointer, file });
			result.problems.push(...checked.problems);
			if (checked.fact) result.facts.set(file.path, checked.fact);
			if (file.path === 'record.json' && checked.bytes) result.files.set(file.path, checked.bytes);
		}
		return hubAttachedRecord(result);
	}
	/** Freshly reads only a file whose full-record hash and size were already attested. */
	async readFile(pointer: EvidencePointer, path: string): Promise<Uint8Array> {
		const loaded = await this.load(pointer),
			fact = loaded.facts.get(path);
		if (loaded.problems.length || !fact) return hubFail('artifact-refused');
		if (fact.bytes > artifactLimit) return hubFail('artifact-too-large');
		const checked = await this.queue(async () => {
			const source = await hubPinnedSource(this.context.base, loaded.pointer.commit);
			return hubEvidenceFile(source, { pointer: loaded.pointer, file: fact });
		});
		if (checked.problems.length || !checked.bytes || checked.fact?.blob !== fact.blob)
			return hubFail('artifact-refused');
		return checked.bytes;
	}
}
