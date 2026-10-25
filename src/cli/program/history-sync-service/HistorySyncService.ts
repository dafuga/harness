import { ModuleDataRepository } from '../../../repositories/git-source-history/ModuleDataRepository';
import type { Relation, RefChange, Synced } from './HistorySyncService.types';
import { EvidenceTreeAdapter } from '../../../adapters/verification-evidence/EvidenceTreeAdapter';
import { LfsAdapter } from '../../../adapters/git-source-history/LfsAdapter';
import { fail } from '../../../core/development-tooling/errors';
import {
	evidenceRef,
	notesRef,
	remoteTrackingPrefix,
	sourceArchivePrefix
} from '../../../core/git-source-history/historyTypes';
import { HistoryNoteRepository } from '../../../repositories/git-source-history/history-note-repository/HistoryNoteRepository';
import { historyRefs } from './historyRefs';

const changes: Record<Relation, RefChange> = {
	none: 'absent',
	same: 'unchanged',
	ahead: 'unchanged',
	behind: 'fast-forwarded',
	new: 'created',
	diverged: 'merged'
};

/**
 * Exchanges evidence, notes and archived source refs with a remote. Histories are combined by
 * fast-forward or by a merge that keeps every record of both sides; nothing is ever forced.
 */
export class HistorySyncService {
	private readonly tree: EvidenceTreeAdapter;
	private readonly lfs: LfsAdapter;
	private readonly notes: HistoryNoteRepository;

	constructor(root: string) {
		this.tree = new EvidenceTreeAdapter(root);
		this.lfs = new LfsAdapter(root);
		this.notes = new HistoryNoteRepository(root);
	}

	/** Brings the remote's records here and merges them with the local ones. */
	async fetch(remote: string): Promise<Synced> {
		const theirs = await this.remoteRefs(remote);
		await new ModuleDataRepository(this.tree.git.root).fetch(remote);
		const tracking = (name: string) => `${remoteTrackingPrefix}${remote}/${name}`;
		const wanted = [
			...(theirs.has(evidenceRef) ? [`+${evidenceRef}:${tracking('evidence')}`] : []),
			...(theirs.has(notesRef) ? [`+${notesRef}:${tracking('notes')}`] : []),
			`${sourceArchivePrefix}*:${sourceArchivePrefix}*`
		];
		await this.tree.git.run(['fetch', '--quiet', '--no-tags', remote, ...wanted]);
		const evidence = await this.mergeEvidence(theirs.get(evidenceRef), remote);
		const notes = await this.mergeNotes(theirs.get(notesRef), tracking('notes'));
		const missing = (await this.tree.tip(evidenceRef))
			? await this.lfs.fetch(remote, evidenceRef)
			: undefined;
		const problems = missing
			? { problems: [`media could not be fetched from ${remote}: ${missing}`] }
			: {};
		return { remote, evidence, notes, pushed: false, ...problems };
	}

	/** Sends local records; refuses, without changing the remote, if it has records we lack. */
	async push(remote: string): Promise<Synced> {
		const theirs = await this.remoteRefs(remote);
		const evidence = await this.ahead(evidenceRef, theirs.get(evidenceRef), remote);
		const notes = await this.ahead(notesRef, theirs.get(notesRef), remote);
		const archived = await this.tree.git.run([
			'for-each-ref',
			'--format=%(refname)',
			sourceArchivePrefix
		]);
		const sent = (change: RefChange) => change === 'created' || change === 'fast-forwarded';
		const refs = [
			...(sent(evidence) ? [evidenceRef] : []),
			...archived.split('\n').filter((ref) => ref && !theirs.has(ref)),
			...(sent(notes) ? [notesRef] : [])
		];
		if (await this.tree.tip(evidenceRef)) await this.lfs.push(remote, evidenceRef);
		const specs = refs.map((ref) => `${ref}:${ref}`);
		if (specs.length > 0) await this.tree.git.run(['push', '--quiet', remote, ...specs]);
		return { remote, evidence, notes, pushed: specs.length > 0 };
	}

	/** Fetch, merge, then push: both sides end with every record of both. */
	async sync(remote: string): Promise<Synced> {
		const fetched = await this.fetch(remote);
		const pushed = await this.push(remote);
		await new ModuleDataRepository(this.tree.git.root).sync(remote);
		return { ...fetched, pushed: pushed.pushed };
	}

	private async remoteRefs(remote: string): Promise<Map<string, string>> {
		const { evidence, notes, archives } = historyRefs();
		const listed = await this.tree.git.run(['ls-remote', remote, evidence, notes, archives]);
		const lines = listed.split('\n').filter(Boolean);
		return new Map(lines.map((line) => line.split(/\s+/).reverse() as [string, string]));
	}

	private async relation(local: string | undefined, theirs: string | undefined): Promise<Relation> {
		if (!theirs) return local ? 'ahead' : 'none';
		if (!local) return 'new';
		if (local === theirs) return 'same';
		if (await this.tree.contains(local, theirs)) return 'ahead';
		return (await this.tree.contains(theirs, local)) ? 'behind' : 'diverged';
	}

	/** Push is allowed only when the remote is where we were or behind us. */
	private async ahead(ref: string, theirs: string | undefined, remote: string): Promise<RefChange> {
		const local = await this.tree.tip(ref);
		const relation = await this.relation(theirs, local);
		if (relation === 'ahead' || relation === 'diverged') {
			const what = ref === notesRef ? 'notes' : 'evidence';
			return fail(`${remote} has ${what} this clone lacks; run harness history sync ${remote}.`);
		}
		return changes[relation];
	}

	private async mergeEvidence(theirs: string | undefined, remote: string): Promise<RefChange> {
		const local = await this.tree.tip(evidenceRef);
		const relation = await this.relation(local, theirs);
		const next =
			relation === 'diverged' && local && theirs
				? await union(this.tree, { local, theirs, remote })
				: theirs;
		const moves = relation === 'behind' || relation === 'new' || relation === 'diverged';
		if (moves && next && !(await this.tree.advance(evidenceRef, next, local))) {
			return fail('The evidence branch moved during the merge; run the command again.');
		}
		return changes[relation];
	}

	private async mergeNotes(theirs: string | undefined, tracking: string): Promise<RefChange> {
		const relation = await this.relation(await this.tree.tip(notesRef), theirs);
		const moves = relation === 'behind' || relation === 'new' || relation === 'diverged';
		if (moves) await this.notes.merge(tracking);
		return changes[relation];
	}
}

/** A merge commit holding every file of both sides; a path may never differ between them. */
async function union(
	tree: EvidenceTreeAdapter,
	sides: { local: string; theirs: string; remote: string }
): Promise<string> {
	const [ours, other] = [await tree.list(sides.local), await tree.list(sides.theirs)];
	const added = [...other].filter(([path]) => !ours.has(path));
	const clash = [...other].find(
		([path, blob]) => path.includes('/') && (ours.get(path) ?? blob) !== blob
	);
	if (clash) {
		const where = `this clone and ${sides.remote}`;
		return fail(`Evidence path ${clash[0]} differs between ${where}; nothing was merged.`);
	}
	return tree.commit({
		parents: [sides.local, sides.theirs],
		files: added.map(([path, blob]) => ({ path, content: { blob } })),
		message: `chore: merge evidence from ${sides.remote}`
	});
}

export type { RefChange, Synced } from './HistorySyncService.types';
