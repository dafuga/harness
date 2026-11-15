// @harness-uid u_xetkmrxgc7
import { VideoReferenceService } from '../../VideoReferenceService';
import type { AttachedRecord, AttachedRecordReadOptions } from './AttachedRecordService.types';

export async function recordReferences(
	root: string,
	loaded: AttachedRecord,
	scope: {
		within?: string | null;
		options: AttachedRecordReadOptions;
	}
): Promise<AttachedRecord> {
	const record = loaded.record;
	if (!record || loaded.problems.length) return loaded;
	const trail = scope.options.trail ?? [];
	if (trail.includes(record.id))
		return { ...loaded, problems: ['inherited video records form a cycle'] };
	try {
		const within = loaded.pointer.commit;
		const service = new VideoReferenceService(
			root,
			{ evidence: within, notes: scope.options.notes },
			[...trail, record.id],
			scope.options.retainMedia !== false
		);
		const files = await service.materialize(
			record,
			loaded.manifest!.files.map((file) => file.path)
		);
		for (const [path, bytes] of files) loaded.files.set(path, bytes);
	} catch (error) {
		loaded.problems.push(
			`Referenced video integrity failed: ${error instanceof Error ? error.message : 'unavailable proof'}`
		);
	}
	if (scope.options.retainMedia === false) loaded.files.clear();
	return loaded;
}
