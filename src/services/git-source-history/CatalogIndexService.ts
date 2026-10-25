import { chmod, mkdtemp, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { openSqlite } from '../../adapters/development-tooling/openSqlite';
import type { HistoryIndex } from '../../core/historyIndexTypes';
import { CatalogRepository } from '../../repositories/git-source-history/CatalogRepository';
import type { CatalogSnapshot } from './CatalogWriteService';

/** Builds a replacement beside its destination; failed indexing leaves the prior DB intact. */
export class CatalogIndexService {
	async write(
		directory: string,
		index: HistoryIndex,
		snapshots: Iterable<CatalogSnapshot>
	): Promise<string> {
		const temporary = await mkdtemp(join(directory, '.catalog-'));
		const path = join(temporary, 'catalog.sqlite');
		try {
			const db = openSqlite(path);
			try {
				new CatalogRepository(db).replace(index, snapshots);
			} finally {
				db.close();
			}
			await chmod(path, 0o600);
			const destination = join(directory, 'catalog.sqlite');
			await rename(path, destination);
			return destination;
		} finally {
			await rm(temporary, { recursive: true, force: true });
		}
	}
}
