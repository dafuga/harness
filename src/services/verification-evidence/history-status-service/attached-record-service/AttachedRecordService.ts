import type { AttachedRecord } from './AttachedRecordService.types';
import { createHash } from 'node:crypto';
import { LfsAdapter } from '../../../../adapters/git-source-history/LfsAdapter';
import {
	evidenceManifestSchema,
	type EvidenceFile,
	type EvidencePointer
} from '../../../../core/git-source-history/historyTypes';
import { EvidenceBranchRepository } from '../../../../repositories/verification-evidence/evidence-branch-repository/EvidenceBranchRepository';
import { recordFiles } from '../../../../utils/verification-evidence/evidenceManifest';
import { parseLfsPointer } from './lfsPointer';
import { recordIntact } from '../../../../utils/verification-evidence/sealRecord';
import { VerificationRecordValidator } from '../../../../validators/verification-evidence/VerificationRecordValidator';

/**
 * Loads one stored directory from the evidence branch and validates all of it: the manifest
 * against the note, every file against the manifest, and media against its LFS object.
 */
export class AttachedRecordService {
	private readonly evidence: EvidenceBranchRepository;
	private readonly lfs: LfsAdapter;
	private readonly loaded = new Map<string, Promise<AttachedRecord>>();

	/**
	 * `within` pins the evidence: a pointer is followed only when its commit is part of the
	 * history of that evidence commit, and none is when it is null. Unpinned, each stored one is.
	 */
	constructor(
		root: string,
		private readonly within?: string | null
	) {
		this.evidence = new EvidenceBranchRepository(root);
		this.lfs = new LfsAdapter(root);
	}

	/** Keep a bounded working set of intact directories; evicted bytes are rehashed on reuse. */
	load(pointer: EvidencePointer): Promise<AttachedRecord> {
		const key = `${pointer.commit}:${pointer.path}:${pointer.manifest}`;
		const pending = this.loaded.get(key) ?? this.read(pointer);
		this.loaded.delete(key);
		this.loaded.set(key, pending);
		if (this.loaded.size > 4) this.loaded.delete(this.loaded.keys().next().value!);
		return pending;
	}

	private async read(pointer: EvidencePointer): Promise<AttachedRecord> {
		const result: AttachedRecord = { pointer, files: new Map(), problems: [] };
		const { tree } = this.evidence;
		if (!(await tree.exists(pointer.commit))) {
			const missing = `evidence commit ${short(pointer.commit)} is not available`;
			return { ...result, problems: [`${missing}; run harness history fetch`] };
		}
		const { within } = this;
		const outside = within === null || (within && !(await tree.contains(within, pointer.commit)));
		if (outside) {
			const stray = `evidence commit ${short(pointer.commit)} is not part of the pinned evidence`;
			return { ...result, problems: [stray] };
		}
		const text = await tree.read(pointer.commit, `${pointer.path}/manifest.json`);
		if (!text || sha256(text) !== pointer.manifest) {
			return { ...result, problems: ['manifest does not match the hash in the note'] };
		}
		const manifest = evidenceManifestSchema.safeParse(parseJson(text));
		if (!manifest.success) return { ...result, problems: ['manifest is not valid'] };
		result.manifest = manifest.data;
		const paths = manifest.data.files.map((file) => `${pointer.path}/${file.path}`);
		const blobs = await tree.readMany(pointer.commit, paths);
		for (const file of manifest.data.files) {
			const blob = blobs.get(`${pointer.path}/${file.path}`);
			result.problems.push(...(await this.file(blob, file, result.files)));
		}
		return this.withRecord(result);
	}

	/** Reads one file and compares it with the manifest; media comes from its LFS object. */
	private async file(
		blob: Buffer | undefined,
		file: EvidenceFile,
		files: Map<string, Buffer>
	): Promise<string[]> {
		if (!blob) return [`${file.path} is missing from the evidence branch`];
		if (file.storage === 'git') {
			files.set(file.path, blob);
			return sha256(blob) === file.sha256 ? [] : [`${file.path} does not match its manifest`];
		}
		const stated = parseLfsPointer(blob.toString('utf8'));
		if (stated?.sha256 !== file.sha256 || stated.bytes !== file.bytes) {
			return [`${file.path} does not match its manifest`];
		}
		const bytes = await this.lfs.read(file.sha256);
		if (!bytes) return [`media ${file.path} is not available locally; run harness history fetch`];
		files.set(file.path, bytes);
		return sha256(bytes) === file.sha256
			? []
			: [`media ${file.path} does not match its recorded hash`];
	}

	/** The record must be sealed, and every file it names must be in the manifest unchanged. */
	private withRecord(result: AttachedRecord): AttachedRecord {
		const bytes = result.files.get('record.json');
		const parsed = bytes ? new VerificationRecordValidator().validate(parseJson(bytes)) : undefined;
		const record = parsed?.value;
		if (!record)
			return { ...result, problems: [...result.problems, 'record.json is not a record'] };
		const listed = new Map(result.manifest?.files.map((file) => [file.path, file.sha256]));
		const unlisted = recordFiles(record)
			.filter((file) => listed.get(file.path) !== file.sha256)
			.map((file) => `evidence ${file.path} is not in the manifest`);
		const sealed = recordIntact(record) ? [] : ['record content does not match its id'];
		return { ...result, record, problems: [...result.problems, ...sealed, ...unlisted] };
	}
}

function parseJson(bytes: Buffer): unknown {
	try {
		return JSON.parse(bytes.toString('utf8')) as unknown;
	} catch {
		return undefined;
	}
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function short(id: string): string {
	return id.slice(0, 12);
}

export type { AttachedRecord } from './AttachedRecordService.types';
