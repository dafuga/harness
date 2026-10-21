/**
 * What every client of one computer shares about a repository: who runs an agent in it, and the
 * order of its planning writes. A window and a phone each have their own session; this is common.
 */
export class RepositoryArbiterService {
	private readonly runs = new Map<string, object>();
	private readonly writes = new Map<string, Promise<unknown>>();
	/** True when `owner` holds the run lock afterwards; false when another owner has it. */
	hold(root: string, owner: object): boolean {
		const holder = this.runs.get(root);
		if (holder && holder !== owner) return false;
		this.runs.set(root, owner);
		return true;
	}
	/** Only the holder releases. */
	release(root: string, owner: object): void {
		if (this.runs.get(root) === owner) this.runs.delete(root);
	}
	held(root: string | null): boolean {
		return root !== null && this.runs.has(root);
	}
	/** One write of a repository at a time, in the order asked, whatever the one before it did. */
	exclusive<T>(root: string, work: () => Promise<T>): Promise<T> {
		const next = (this.writes.get(root) ?? Promise.resolve()).then(work),
			tail = next.catch(() => undefined);
		this.writes.set(root, tail);
		void tail.then(() => {
			if (this.writes.get(root) === tail) this.writes.delete(root);
		});
		return next;
	}
}
