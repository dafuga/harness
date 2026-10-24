import type { CatalogSnapshot } from './CatalogWriteService.types';
import { createHash } from 'node:crypto';
import type { SqliteAdapter } from '../../adapters/development-tooling/SqliteAdapter';
import type { HistoryIndex } from '../../core/historyIndexTypes';
import { CatalogBranch } from '../../models/git-source-history/CatalogBranch';
import { CatalogDependency } from '../../models/git-source-history/CatalogDependency';
import { CatalogEntity } from '../../models/git-source-history/CatalogEntity';
import { CatalogMetadata } from '../../models/git-source-history/CatalogMetadata';
import { CatalogRecord } from '../../models/git-source-history/CatalogRecord';
import { CatalogRevision } from '../../models/git-source-history/CatalogRevision';
import { CatalogRevisionEntity } from '../../models/git-source-history/CatalogRevisionEntity';
import { CatalogScenario } from '../../models/git-source-history/CatalogScenario';
import { catalogModels } from '../../core/git-source-history/catalogModels';
import type { RevisionRegistry } from '../../utils/revisionRegistry';
import { sqliteIdentifier } from '../../utils/development-tooling/sqliteTableSql';
import { stableJson } from '../../utils/stableJson';

/** Replaces only the derived query index, in one rollback-safe transaction. */
export class CatalogWriteService {
	constructor(private readonly adapter: SqliteAdapter) {}
	replace(index: HistoryIndex, snapshots: CatalogSnapshot[]): void {
		this.adapter.transaction(() => {
			for (const model of catalogModels)
				this.adapter.execute(`DELETE FROM ${sqliteIdentifier(model.definition.table)}`);
			const available = new Map(snapshots.map((snapshot) => [snapshot.commit, snapshot.registry]));
			for (const branch of index.branches)
				this.adapter.insert(CatalogBranch.definition.table, { id: branch.name, head: branch.head });
			for (const revision of index.revisions)
				this.revision(revision, available.get(revision.commit));
			this.entities(snapshots);
			const digest = createHash('sha256').update(stableJson(index)).digest('hex');
			this.adapter.insert(CatalogMetadata.definition.table, {
				id: 'catalog',
				schemaVersion: 1,
				digest
			});
		});
	}
	private revision(revision: HistoryIndex['revisions'][number], registry?: RevisionRegistry): void {
		this.adapter.insert(CatalogRevision.definition.table, {
			id: revision.commit,
			subject: revision.subject,
			committedAt: revision.committedAt,
			coverage: revision.coverage,
			registryAvailable: registry?.available ?? false,
			data: revision
		});
		for (const record of revision.records)
			this.adapter.insert(CatalogRecord.definition.table, {
				id: JSON.stringify([revision.commit, record.id]),
				commit: revision.commit,
				status: record.status,
				valid: record.valid,
				data: record
			});
		for (const scenario of registry?.scenarios ?? [])
			this.adapter.insert(CatalogScenario.definition.table, {
				id: JSON.stringify([revision.commit, scenario.id]),
				scenarioId: scenario.id,
				commit: revision.commit,
				title: scenario.title,
				data: scenario
			});
	}
	private entities(snapshots: CatalogSnapshot[]): void {
		const versions = new Set<string>();
		for (const snapshot of snapshots)
			for (const entity of snapshot.registry.units) {
				// Budget metadata can change independently of the unit's source version.
				const id = createHash('sha256').update(stableJson(entity)).digest('hex');
				if (!versions.has(id)) this.entity(id, entity);
				versions.add(id);
				this.adapter.insert(CatalogRevisionEntity.definition.table, {
					id: JSON.stringify([snapshot.commit, entity.id]),
					commit: snapshot.commit,
					entityId: id
				});
			}
	}
	private entity(id: string, entity: RevisionRegistry['units'][number]): void {
		this.adapter.insert(CatalogEntity.definition.table, {
			id,
			unitId: entity.id,
			version: entity.version,
			kind: entity.kind,
			title: entity.title,
			responsibility: entity.responsibility,
			data: entity
		});
		const dependencies = new Set<string>();
		for (const dependency of entity.dependencies) {
			const key = JSON.stringify([id, dependency.unit, dependency.via]);
			if (dependencies.has(key)) continue;
			dependencies.add(key);
			this.adapter.insert(CatalogDependency.definition.table, {
				id: key,
				entityId: id,
				targetId: dependency.unit,
				via: dependency.via
			});
		}
	}
}

export type { CatalogSnapshot } from './CatalogWriteService.types';
