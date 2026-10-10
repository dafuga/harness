import { GitAdapter } from '../adapters/GitAdapter';
import {
	VerificationStoreRepository,
	type StoredRecord
} from '../repositories/VerificationStoreRepository';
import { VerificationCheckService } from './VerificationCheckService';

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
		const passing = this.latestPassing();
		if (!from || passing.size === 0) return null;
		const ancestry = await new GitAdapter(this.root).run(['rev-list', from]);
		const checker = new VerificationCheckService(this.root);
		for (const commit of ancestry.split('\n')) {
			const stored = passing.get(commit);
			if (stored && (await checker.check(commit, stored)).status === 'passed') {
				return { commit, record: stored.record.id };
			}
		}
		return null;
	}

	/** The most recent record of each commit, kept only when that record passed. */
	private latestPassing(): Map<string, StoredRecord> {
		const latest = new Map<string, StoredRecord>();
		for (const stored of new VerificationStoreRepository(this.root).all()) {
			const known = latest.get(stored.record.source.commit);
			if (!known || known.record.startedAt < stored.record.startedAt) {
				latest.set(stored.record.source.commit, stored);
			}
		}
		return new Map([...latest].filter(([, stored]) => stored.record.status === 'passed'));
	}
}
