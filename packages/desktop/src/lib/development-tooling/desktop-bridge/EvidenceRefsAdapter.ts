import { createHash } from 'node:crypto';
import { commitPattern } from '../../../utils/development-tooling/ipcFields';
import { gitRead } from '../../../utils/projects-sessions/gitRead';

/** The notes commit and the evidence commit of one read; null where there is no such ref. */
export interface PinnedRevisions {
	notesRevision: string | null;
	evidenceRevision: string | null;
}
export interface CurrentRefs extends PinnedRevisions {
	/** Changes whenever a note, the evidence or an archived source of the repository does. */
	digest: string;
}

export const notesRef = 'refs/notes/harness';
export const evidenceRef = 'refs/heads/harness-evidence';
const listing = ['for-each-ref', '--format=%(refname)%00%(objectname)'];

/**
 * The two refs recorded evidence is read from, as commits. A read is pinned to where they are
 * when it starts; a later read that repeats those commits is served at exactly them, as long
 * as each is still part of its ref.
 */
export class EvidenceRefsAdapter {
	constructor(private readonly root: string) {}

	/** Where the notes and the evidence are now, both from one listing of the refs. */
	async current(): Promise<CurrentRefs> {
		const refs = await gitRead(this.root, [
			...listing,
			'refs/notes/',
			evidenceRef,
			'refs/harness/'
		]);
		const lines = refs.trim().split('\n').filter(Boolean);
		const entries = new Map(lines.map((line) => line.split('\0') as [string, string]));
		return {
			notesRevision: entries.get(notesRef) ?? null,
			evidenceRevision: entries.get(evidenceRef) ?? null,
			digest: createHash('sha256').update(refs).digest('hex')
		};
	}

	/**
	 * The revisions a request repeats, once each is known to be where its ref is or was. One the
	 * ref never held is refused, and so is none where the repository has that ref.
	 */
	async pinned(wanted: PinnedRevisions): Promise<PinnedRevisions> {
		const now = await this.current();
		await this.held('notes', wanted.notesRevision, now.notesRevision);
		await this.held('evidence', wanted.evidenceRevision, now.evidenceRevision);
		return { notesRevision: wanted.notesRevision, evidenceRevision: wanted.evidenceRevision };
	}

	private async held(name: string, wanted: string | null, tip: string | null): Promise<void> {
		if (wanted === tip) return;
		const named = wanted !== null && tip !== null && commitPattern.test(wanted);
		const part = named && (await this.reaches(tip, wanted));
		if (part) return;
		throw new Error(
			`The ${name} revision of this request is not part of the ${name} of this project.`
		);
	}

	/** True when `commit` is `tip` or one of its ancestors. */
	private reaches(tip: string, commit: string): Promise<boolean> {
		return gitRead(this.root, ['merge-base', '--is-ancestor', commit, tip]).then(
			() => true,
			() => false
		);
	}
}
