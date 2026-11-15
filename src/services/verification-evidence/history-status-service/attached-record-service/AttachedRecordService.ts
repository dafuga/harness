// @harness-uid u_xetkmrxgc7
import type {
	AttachedRecord,
	AttachedRecordDescriptor,
	AttachedRecordReadOptions
} from './AttachedRecordService.types';
import { createHash } from 'node:crypto';
import { LfsAdapter } from '../../../../adapters/git-source-history/LfsAdapter';
import {
	type EvidenceFile,
	type EvidencePointer
} from '../../../../core/git-source-history/historyTypes';
import { EvidenceBranchRepository } from '../../../../repositories/verification-evidence/evidence-branch-repository/EvidenceBranchRepository';
import { parseLfsPointer } from './lfsPointer';
import { recordDescriptor } from './recordDescriptor';
import { recordReferences } from './recordReferences';

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
		private readonly root: string,
		private readonly within?: string | null,
		private readonly options: AttachedRecordReadOptions = {}
	) {
		this.evidence = new EvidenceBranchRepository(root);
		this.lfs = new LfsAdapter(root);
	}

	/** Each stored directory is read and hashed once per process. */
	load(pointer: EvidencePointer): Promise<AttachedRecord> {
		const key = `${pointer.commit}:${pointer.path}:${pointer.manifest}`;
		const pending = this.loaded.get(key) ?? this.read(pointer);
		this.loaded.set(key, pending);
		return pending;
	}

	describe(pointer: EvidencePointer): Promise<AttachedRecordDescriptor> {
		return recordDescriptor(this.evidence, pointer, this.within);
	}

	private async read(pointer: EvidencePointer): Promise<AttachedRecord> {
		const descriptor = await this.describe(pointer);
		const result: AttachedRecord = { ...descriptor, files: new Map() };
		if (!descriptor.manifest || descriptor.problems.length) return result;
		const paths = descriptor.manifest.files.map((file) => `${pointer.path}/${file.path}`);
		const blobs = await this.evidence.tree.readMany(pointer.commit, paths);
		for (const file of descriptor.manifest.files) {
			const blob = blobs.get(`${pointer.path}/${file.path}`);
			result.problems.push(...(await this.file(blob, file, result.files)));
		}
		const checked = await recordReferences(this.root, result, {
			within: this.within,
			options: this.options
		});
		if (this.options.retainMedia === false) checked.files.clear();
		return checked;
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
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

export type { AttachedRecord } from './AttachedRecordService.types';
