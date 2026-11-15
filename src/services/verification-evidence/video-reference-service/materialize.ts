// @harness-uid u_alfe4qnget
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { recordFiles } from '../../../utils/verification-evidence/evidenceManifest';
import { referencePaths } from './binding';
import { resolveVideoReference } from './resolve';
import { referenceScope } from './origins';
import type {
	Capture,
	VerificationRecord
} from '../../../core/verification-evidence/verificationTypes';
import type { VideoReferenceContext } from '../VideoReferenceService.types';

/** Virtual media is verified from archive pointers, never copied into the parent manifest. */
export async function materializeVideoReferences(
	root: string,
	record: VerificationRecord,
	scope: {
		context: VideoReferenceContext;
		physical?: string[];
	}
): Promise<Map<string, Buffer>> {
	const captures = validateParentReferences(record, scope.physical),
		batches = record.videoBatches ?? [];
	const files = new Map<string, Buffer>();
	if (!captures.length) return files;
	const context = { ...scope.context, pinned: await referenceScope(root, scope.context) };
	let bytes = 0;
	for (const capture of captures) {
		const trusted = await resolveVideoReference(
			root,
			{ source: record.source, capture, batches },
			context
		);
		bytes = mergeMaterialized(files, trusted.files, bytes);
	}
	return files;
}

function validateParentReferences(record: VerificationRecord, physicalPaths?: string[]): Capture[] {
	const captures = record.scenarios
		.filter((scenario) => scenario.status !== 'referenced')
		.flatMap((scenario) => scenario.states.flatMap((state) => state.captures))
		.filter((capture) => capture.videoReference);
	const used = new Set(captures.map((capture) => capture.videoReference!.batch)),
		batches = record.videoBatches ?? [];
	if (
		batches.some((pointer) => !used.has(pointer.batch)) ||
		new Set(batches.map((pointer) => pointer.batch)).size !== batches.length
	)
		throw new ExpectedCliError(
			'Parent batches must uniquely back its own video captures; batches alone grant no verification proof.'
		);
	const physical = new Set([
		'record.json',
		'manifest.json',
		...(physicalPaths ?? recordFiles(record).map((file) => file.path))
	]);
	for (const capture of captures) {
		if (!capture.video) throw new ExpectedCliError('Video reference has no video metadata.');
		if (referencePaths(capture).some((path) => physical.has(path)))
			throw new ExpectedCliError(
				'Referenced video/poster must not be copied into its parent manifest.'
			);
	}
	return captures;
}

function mergeMaterialized(
	files: Map<string, Buffer>,
	incoming: Map<string, Buffer>,
	bytes: number
): number {
	for (const [path, contents] of incoming) {
		const existing = files.get(path);
		if (existing && !existing.equals(contents))
			throw new ExpectedCliError('Referenced video file paths conflict.');
		if (!existing) bytes += contents.length;
		if (bytes > 512 * 1024 * 1024)
			throw new ExpectedCliError(
				'Parent referenced media exceeds the 512 MiB materialization bound.'
			);
		files.set(path, contents);
	}
	return bytes;
}
