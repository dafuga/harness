import type { HistoryNote } from '../core/historyTypes';
import type { VerificationRecord } from '../core/verificationTypes';

type Note = Extract<HistoryNote, { kind: 'verification' }>;

/** Notes index sealed records; none of their identity fields may contradict the original. */
export function verificationNoteIdentity(
	record: VerificationRecord,
	note: Note,
	tree: string | null | undefined
): string[] {
	const checked: Array<[boolean, string]> = [
		[record.id === note.record, 'record is not the one the note names'],
		[
			record.source.commit === note.source.commit,
			`record is for commit ${record.source.commit}, not ${note.source.commit}`
		],
		[record.source.tree === tree, 'record tree does not match the commit tree'],
		[record.status === note.status, 'record outcome differs from the note'],
		[note.source.tree === record.source.tree, 'note tree differs from the record'],
		[note.source.base === record.source.base, 'note base differs from the record'],
		[note.profile === record.profile.id, 'note profile differs from the record'],
		[note.finishedAt === record.finishedAt, 'note finish time differs from the record']
	];
	return checked.filter(([matches]) => !matches).map(([, problem]) => problem);
}
