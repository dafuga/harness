import { resolve } from 'node:path';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { VerificationStoreRepository } from '../../../repositories/verification-evidence/VerificationStoreRepository';
import { VerificationCheckService } from '../../../services/verification-evidence/VerificationCheckService';

/**
 * Finds the revision a verification may build on. A comparison range only narrows what is
 * rerun when its starting point is itself proven; otherwise an unverified change could pass by
 * being left out of the range.
 */
export class TrustedBaseService {
	constructor(private readonly root: string) {}

	/**
	 * `from` itself when a passing, intact record proves it, otherwise its nearest proven
	 * ancestor. Null when nothing is proven, which means the whole revision must be verified.
	 */
	async nearest(from: string | null): Promise<string | null> {
		return (await this.nearestRecord(from))?.commit ?? null;
	}

	/** The nearest proven revision together with the record that proves it. */
	async nearestRecord(from: string | null): Promise<{ commit: string; record: string } | null> {
		const store = new VerificationStoreRepository(this.root);
		const passing = this.latestPassing(store);
		if (!from || passing.size === 0) return null;
		const ancestry = await new GitAdapter(this.root).run(['rev-list', from]);
		const checker = new VerificationCheckService(this.root);
		for (const commit of ancestry.split('\n')) {
			const entry = passing.get(commit);
			const stored = entry ? store.read(entry.path) : undefined;
			if (!stored || stored.record.id !== entry?.id || stored.record.status !== 'passed') continue;
			if ((await checker.check(commit, stored)).status === 'passed') {
				return { commit, record: stored.record.id };
			}
		}
		return null;
	}

	/** The most recent record of each commit, kept only when that record passed. */
	private latestPassing(store: VerificationStoreRepository) {
		const latest = new Map<
			string,
			{ id: string; startedAt: string; status: string; path: string }
		>();
		for (const { record, directory } of store.records()) {
			const known = latest.get(record.source.commit);
			if (!known || known.startedAt < record.startedAt) {
				latest.set(record.source.commit, {
					id: record.id,
					startedAt: record.startedAt,
					status: record.status,
					path: resolve(directory, 'record.json')
				});
			}
		}
		return new Map([...latest].filter(([, entry]) => entry.status === 'passed'));
	}
}
