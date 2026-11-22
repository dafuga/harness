// @harness-uid u_xetkmrxgc7
import { createHash } from 'node:crypto';
import type { EvidenceBranchRepository } from '../../../../repositories/verification-evidence/evidence-branch-repository/EvidenceBranchRepository';
import {
	evidenceManifestSchema,
	type EvidencePointer,
	type EvidenceManifest
} from '../../../../core/git-source-history/historyTypes';
import { VerificationRecordValidator } from '../../../../validators/verification-evidence/VerificationRecordValidator';
import { recordIntact } from '../../../../utils/verification-evidence/sealRecord';
import { recordFiles } from '../../../../utils/verification-evidence/evidenceManifest';
import type { AttachedRecordDescriptor } from './AttachedRecordService.types';

/** Metadata discovery grants no media proof; all files are still checked by load(). */
export async function recordDescriptor(
	repository: EvidenceBranchRepository,
	pointer: EvidencePointer,
	within?: string | null
): Promise<AttachedRecordDescriptor> {
	const result: AttachedRecordDescriptor = { pointer, integrity: 'metadata-only', problems: [] },
		{ tree } = repository;
	if (!(await tree.exists(pointer.commit)))
		return { ...result, problems: ['evidence commit is not available; run harness history fetch'] };
	if (within === null || (within && !(await tree.contains(within, pointer.commit))))
		return { ...result, problems: ['evidence commit is not part of the pinned evidence'] };
	const text = await metadataBlob(repository, pointer, 'manifest.json');
	if (!text || digest(text) !== pointer.manifest)
		return { ...result, problems: ['manifest does not match the hash in the note'] };
	const parsed = evidenceManifestSchema.safeParse(parse(text));
	if (!parsed.success) return { ...result, problems: ['manifest is not valid'] };
	result.manifest = parsed.data;
	return { ...result, ...(await descriptorRecord(repository, pointer, parsed.data)) };
}

async function descriptorRecord(
	repository: EvidenceBranchRepository,
	pointer: EvidencePointer,
	manifest: EvidenceManifest
): Promise<Pick<AttachedRecordDescriptor, 'record' | 'problems'>> {
	const bytes = await metadataBlob(repository, pointer, 'record.json');
	const listed = manifest.files.find((file) => file.path === 'record.json');
	if (!bytes || listed?.sha256 !== digest(bytes) || listed.bytes !== bytes.length)
		return { problems: ['record.json does not match its manifest'] };
	const validated = new VerificationRecordValidator().validate(parse(bytes));
	if (!validated.value || validated.errors.length)
		return { problems: ['record.json is not a record'] };
	const record = validated.value;
	return { record, problems: descriptorProblems(record, manifest) };
}

function descriptorProblems(
	record: NonNullable<AttachedRecordDescriptor['record']>,
	manifest: EvidenceManifest
): string[] {
	const hashes = new Map(manifest.files.map((file) => [file.path, file.sha256]));
	const problems = recordFiles(record)
		.filter((file) => hashes.get(file.path) !== file.sha256)
		.map((file) => `evidence ${file.path} is not in the manifest`);
	if (!recordIntact(record)) problems.push('record content does not match its id');
	if (
		manifest.record !== record.id ||
		manifest.source.commit !== record.source.commit ||
		manifest.source.tree !== record.source.tree ||
		manifest.status !== record.status
	)
		problems.push('manifest identity differs from its record');
	return problems;
}

async function metadataBlob(
	repository: EvidenceBranchRepository,
	pointer: EvidencePointer,
	name: string
): Promise<Buffer | undefined> {
	const path = `${pointer.path}/${name}`;
	const size = Number(
		await repository.tree.git.attempt(['cat-file', '-s', `${pointer.commit}:${path}`])
	);
	if (!Number.isSafeInteger(size) || size < 1 || size > 128 * 1024 * 1024) return undefined;
	return repository.tree.read(pointer.commit, path);
}
function parse(bytes: Buffer): unknown {
	try {
		return JSON.parse(bytes.toString());
	} catch {
		return undefined;
	}
}
function digest(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}
