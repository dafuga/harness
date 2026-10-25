import { associatedTests, testImporters } from './associatedTests';
import type { StoredSide } from '../../../utils/explorer-ui/sideImpact';
import type { Unit } from './SourceArchiveService.types';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CommitTreeAdapter } from '../../../adapters/git-source-history/CommitTreeAdapter';
import type { TreeEntry } from '../../../core/development-tooling/sourceTypes';
import type { SourceFileSnapshot } from '../../../utils/explorer-ui/unitMetadata';

/** Retains committed implementations and associated tests as deduplicated private media, never reading the working tree. */
export class SourceArchiveService {
	private readonly written = new Map<string, Promise<void>>();
	private readonly retained = new Map<string, Promise<Omit<SourceFileSnapshot, 'path'>>>();
	constructor(
		private readonly root: string,
		private readonly out: string
	) {}

	async archive(commit: string, units: Unit[], side?: StoredSide): Promise<void> {
		const tree = await CommitTreeAdapter.open(this.root, commit);
		const entries = await tree.list();
		const blobs = new Map(entries.map((entry) => [entry.path, entry.hash]));
		const owned = new Map(
			units.map((unit) => [unit, unit.status === 'active' ? pathsFor(unit, entries, blobs) : []])
		);
		const imports = testImporters(side);
		const tests = new Map(
			units.map((unit) => [
				unit,
				unit.status === 'active' && side
					? associatedTests(unit, owned.get(unit)!, side, imports)
					: []
			])
		);
		const paths = [...new Set([...owned.values(), ...tests.values()].flat())];
		const files = new Map<string, SourceFileSnapshot>();
		await mkdir(join(this.out, 'media'), { recursive: true });
		for (let start = 0; start < paths.length; start += 64) {
			await Promise.all(
				paths.slice(start, start + 64).map(async (path) => {
					files.set(path, await this.file(tree, path, blobs.get(path)));
				})
			);
		}
		for (const [unit, paths] of owned) {
			unit.sourceFiles = paths.map((path) => files.get(path)!);
			if (side) unit.testFiles = tests.get(unit)!.map((path) => files.get(path)!);
		}
	}

	private async file(
		tree: CommitTreeAdapter,
		path: string,
		hash?: string
	): Promise<SourceFileSnapshot> {
		const pending = (hash ? this.retained.get(hash) : undefined) ?? this.content(tree, path);
		if (hash) this.retained.set(hash, pending);
		const snapshot = await pending;
		if (hash && !snapshot.media) this.retained.delete(hash);
		return { path, ...snapshot };
	}

	private async content(
		tree: CommitTreeAdapter,
		path: string
	): Promise<Omit<SourceFileSnapshot, 'path'>> {
		try {
			const text = await tree.read(path);
			if (text.includes('\0') || text.includes('\uFFFD'))
				return { media: null, gap: 'This source cannot be represented as readable text.' };
			const media = `media/${createHash('sha256').update(text).digest('hex')}.txt`;
			const pending = this.written.get(media) ?? writeFile(join(this.out, media), text, 'utf8');
			this.written.set(media, pending);
			await pending;
			return { media };
		} catch {
			return { media: null, gap: 'Source contents are unavailable at this revision.' };
		}
	}
}

function pathsFor(unit: Unit, entries: TreeEntry[], blobs: Map<string, string>): string[] {
	return [
		...new Set(
			unit.owns.source.flatMap((owned) => {
				if (blobs.has(owned)) return [owned];
				const prefix = owned.replace(/\/$/, '') + '/';
				const found = entries.filter(({ path }) => path === owned || path.startsWith(prefix));
				return found.length ? found.map(({ path }) => path) : [owned];
			})
		)
	];
}
