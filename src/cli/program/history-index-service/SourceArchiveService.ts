import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CommitTreeAdapter } from '../../../adapters/git-source-history/CommitTreeAdapter';
import type { TreeEntry } from '../../../core/development-tooling/sourceTypes';
import type { RevisionRegistry } from '../../../utils/verification-evidence/revision-registry/revisionRegistry';
import type { SourceFileSnapshot } from '../../../utils/explorer-ui/unitMetadata';

type Unit = RevisionRegistry['units'][number];

/** Retains owned committed text as deduplicated private media, never reading the working tree. */
export class SourceArchiveService {
	private readonly written = new Map<string, Promise<void>>();
	constructor(
		private readonly root: string,
		private readonly out: string
	) {}

	async archive(commit: string, units: Unit[]): Promise<void> {
		const tree = await CommitTreeAdapter.open(this.root, commit);
		const entries = await tree.list();
		const owned = new Map(
			units.map((unit) => [unit, unit.status === 'active' ? pathsFor(unit, entries) : []])
		);
		const paths = [...new Set([...owned.values()].flat())];
		const files = new Map<string, SourceFileSnapshot>();
		await mkdir(join(this.out, 'media'), { recursive: true });
		for (let start = 0; start < paths.length; start += 64) {
			await Promise.all(
				paths.slice(start, start + 64).map(async (path) => {
					files.set(path, await this.file(tree, path));
				})
			);
		}
		for (const [unit, paths] of owned) unit.sourceFiles = paths.map((path) => files.get(path)!);
	}

	private async file(tree: CommitTreeAdapter, path: string): Promise<SourceFileSnapshot> {
		try {
			const text = await tree.read(path);
			if (text.includes('\0') || text.includes('\uFFFD'))
				return { path, media: null, gap: 'This source cannot be represented as readable text.' };
			const media = `media/${createHash('sha256').update(text).digest('hex')}.txt`;
			const pending = this.written.get(media) ?? writeFile(join(this.out, media), text, 'utf8');
			this.written.set(media, pending);
			await pending;
			return { path, media };
		} catch {
			return { path, media: null, gap: 'Source contents are unavailable at this revision.' };
		}
	}
}

function pathsFor(unit: Unit, entries: TreeEntry[]): string[] {
	return [
		...new Set(
			unit.owns.source.flatMap((owned) => {
				const prefix = owned.replace(/\/$/, '') + '/';
				const found = entries.filter(({ path }) => path === owned || path.startsWith(prefix));
				return found.length ? found.map(({ path }) => path) : [owned];
			})
		)
	];
}
