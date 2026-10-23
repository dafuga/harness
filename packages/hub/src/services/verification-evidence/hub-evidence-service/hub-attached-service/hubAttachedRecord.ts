import type { Sealed, Manifest } from './hubAttachedRecord.types';
import type { HubAttachedRecord } from '../../../../utils/verification-evidence/hubAttachedRecord';
import { hubRecordJson } from '../../../../utils/verification-evidence/hubAttachedRecord';
import { recordIntact } from '../../../../../../../src/utils/sealRecord';
import { VerificationRecordValidator } from '../../../../../../../src/validators/VerificationRecordValidator';

/** Every file the record itself names: its test logs, and captures of scenarios it ran. */
function declaredFiles(record: Sealed) {
	return [
		...record.tests.map((test) => ({ ...test.log, mediaType: undefined })),
		...record.scenarios
			.filter((scenario) => scenario.status !== 'referenced')
			.flatMap((scenario) => scenario.states.flatMap((state) => state.captures))
	];
}

/** A declared file must be in the manifest with the same hash, size and media type. */
function unlistedFiles(manifest: Manifest, record: Sealed): string[] {
	const listed = new Map(manifest.files.map((file) => [file.path, file]));
	return declaredFiles(record).flatMap((file) => {
		const held = listed.get(file.path);
		return held?.sha256 === file.sha256 &&
			held.bytes === file.bytes &&
			held.mediaType === file.mediaType
			? []
			: [`evidence ${file.path} is not in the manifest`];
	});
}

/** The manifest must be about this very record: its id, outcome, source commit and tree. */
function sameIdentity(manifest: Manifest, record: Sealed): boolean {
	return (
		manifest.record === record.id &&
		manifest.status === record.status &&
		manifest.source.commit === record.source.commit &&
		manifest.source.tree === record.source.tree
	);
}

/** Validate the complete original before any unit-specific projection. */
export function hubAttachedRecord(result: HubAttachedRecord): HubAttachedRecord {
	const bytes = result.files.get('record.json');
	const parsed = bytes
		? new VerificationRecordValidator().validate(hubRecordJson(bytes))
		: undefined;
	const record = parsed?.value;
	if (!record)
		return {
			...result,
			problems: [...result.problems, 'record.json is not a record']
		};
	const manifest = result.manifest!;
	const problems = [
		...result.problems,
		...(parsed?.errors ?? []),
		...(recordIntact(record) ? [] : ['record content does not match its id']),
		...(sameIdentity(manifest, record) ? [] : ['manifest identity differs from the record']),
		...unlistedFiles(manifest, record)
	];
	return { ...result, record, problems };
}
