import { CommitTreeAdapter } from './CommitTreeAdapter';
import type { SourceTree, TreeEntry } from '../../core/development-tooling/sourceTypes';
import type { ModuleSourceText } from './ModuleDataSourceAdapter.types';
const maximumBytes = 64 * 1024 * 1024;
const texts = new Map<string, ModuleSourceText>();
const pending = new Map<string, Promise<string>>();
let retainedBytes = 0;

/** Reuse exact immutable Git blob text while producing metadata across historical revisions. */
export class ModuleDataSourceAdapter implements SourceTree {
	readonly revision: string;
	private readonly entries: Promise<Map<string, string>>;
	private constructor(
		private readonly root: string,
		private readonly tree: SourceTree
	) {
		this.revision = tree.revision;
		this.entries = tree
			.list()
			.then((entries) => new Map(entries.map((entry) => [entry.path, entry.hash])));
	}
	static async open(root: string, revision: string): Promise<ModuleDataSourceAdapter> {
		return new ModuleDataSourceAdapter(root, await CommitTreeAdapter.open(root, revision));
	}
	list(): Promise<TreeEntry[]> {
		return this.tree.list();
	}
	async read(path: string): Promise<string> {
		const hash = (await this.entries).get(path);
		if (!hash) throw new Error(`${path} does not exist at ${this.revision}`);
		const key = `${this.root}\0${hash}`;
		const cached = texts.get(key);
		if (cached) return cached.text;
		const waiting = pending.get(key);
		if (waiting) return waiting;
		const reading = this.tree
			.read(path)
			.then((text) => {
				remember(key, text);
				return text;
			})
			.finally(() => pending.delete(key));
		pending.set(key, reading);
		return reading;
	}
}
function remember(key: string, text: string) {
	const bytes = Buffer.byteLength(text);
	if (bytes > maximumBytes) return;
	while (retainedBytes + bytes > maximumBytes) {
		const first = texts.keys().next().value!;
		retainedBytes -= texts.get(first)!.bytes;
		texts.delete(first);
	}
	texts.set(key, { text, bytes });
	retainedBytes += bytes;
}
