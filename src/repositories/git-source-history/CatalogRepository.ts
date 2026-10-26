import type { CatalogQuery } from './CatalogRepository.types';
import { createSqliteAdapter } from '../../adapters/development-tooling/SqliteAdapter';
import type { HistoryIndex, IndexedRevision } from '../../core/historyIndexTypes';
import type { SqliteDatabase, SqliteValue } from '../../core/development-tooling/sqliteTypes';
import { catalogModels } from '../../core/git-source-history/catalogModels';
import {
	CatalogWriteService,
	type CatalogSnapshot
} from '../../services/git-source-history/CatalogWriteService';
import type { RevisionRegistry } from '../../utils/revisionRegistry';
/** Indexed reads of declared entities and their recorded history; no source-tree scans. */
export class CatalogRepository {
	readonly adapter;
	constructor(db: SqliteDatabase, initialize = true) {
		this.adapter = createSqliteAdapter(
			db,
			catalogModels.map((model) => model.definition)
		);
		if (initialize) this.adapter.createTables();
		this.adapter.assertModels();
		const schema = this.adapter.query<{ schema_version: number }>(
			"SELECT schema_version FROM catalog_metadata WHERE id='catalog'"
		)[0];
		if (schema && schema.schema_version !== 1)
			throw new Error('Unsupported SQLite catalog schema version');
		if (initialize) this.indexes();
	}
	replace(index: HistoryIndex, snapshots: Iterable<CatalogSnapshot>): void {
		new CatalogWriteService(this.adapter).replace(index, snapshots);
	}
	private indexes(): void {
		for (const sql of [
			'CREATE INDEX IF NOT EXISTS catalog_entities_kind ON catalog_entities(kind, title)',
			'CREATE INDEX IF NOT EXISTS catalog_entities_unit ON catalog_entities(unit_id)',
			'CREATE INDEX IF NOT EXISTS catalog_membership_commit ON catalog_revision_entities("commit", entity_id)',
			'CREATE INDEX IF NOT EXISTS catalog_membership_entity ON catalog_revision_entities(entity_id, "commit")',
			'CREATE INDEX IF NOT EXISTS catalog_dependencies_source ON catalog_dependencies(entity_id)',
			'CREATE INDEX IF NOT EXISTS catalog_dependencies_target ON catalog_dependencies(target_id)',
			'CREATE INDEX IF NOT EXISTS catalog_scenarios_commit ON catalog_scenarios("commit")',
			'CREATE INDEX IF NOT EXISTS catalog_records_commit ON catalog_records("commit")'
		])
			this.adapter.execute(sql);
	}
	entities(options: CatalogQuery = {}): RevisionRegistry['units'] {
		const where = ['m."commit" = ?'];
		const bindings: SqliteValue[] = [this.commit(options.commit)];
		if (options.kind) {
			where.push('e.kind = ?');
			bindings.push(options.kind);
		}
		if (options.search) {
			where.push('(instr(lower(e.title), lower(?)) > 0 OR instr(lower(e.unit_id), lower(?)) > 0)');
			bindings.push(options.search, options.search);
		}
		const limit = options.limit ?? 100;
		const offset = options.offset ?? 0;
		this.pagination(limit, offset);
		return this.read(
			`SELECT e.data FROM catalog_entities e JOIN catalog_revision_entities m ON m.entity_id=e.id
			WHERE ${where.join(' AND ')} ORDER BY e.title, e.unit_id LIMIT ? OFFSET ?`,
			[...bindings, limit, offset]
		);
	}
	private pagination(limit: number, offset: number): void {
		if (
			!Number.isInteger(limit) ||
			limit < 1 ||
			limit > 10000 ||
			!Number.isInteger(offset) ||
			offset < 0
		)
			throw new Error('Invalid catalog pagination');
	}
	dependencies(unitId: string, commit?: string): Array<{ unit: string; via: string }> {
		return this.adapter.query(
			`SELECT d.target_id AS unit, d.via FROM catalog_dependencies d
			JOIN catalog_entities e ON e.id=d.entity_id JOIN catalog_revision_entities m ON m.entity_id=e.id
			WHERE e.unit_id=? AND m."commit"=? ORDER BY d.target_id, d.via`,
			[unitId, this.commit(commit)]
		);
	}
	consumers(unitId: string, commit?: string): Array<{ unit: string; via: string }> {
		return this.adapter.query(
			`SELECT e.unit_id AS unit, d.via FROM catalog_dependencies d
			JOIN catalog_entities e ON e.id=d.entity_id JOIN catalog_revision_entities m ON m.entity_id=e.id
			WHERE d.target_id=? AND m."commit"=? ORDER BY e.unit_id, d.via`,
			[unitId, this.commit(commit)]
		);
	}
	history(unitId: string): IndexedRevision[] {
		return this.read(
			`SELECT r.data FROM catalog_revisions r JOIN catalog_revision_entities m ON m."commit"=r.id
			JOIN catalog_entities e ON e.id=m.entity_id WHERE e.unit_id=? ORDER BY r.committed_at DESC, r.id`,
			[unitId]
		);
	}
	records(commit?: string): HistoryIndex['revisions'][number]['records'] {
		return this.read('SELECT data FROM catalog_records WHERE "commit"=? ORDER BY id', [
			this.commit(commit)
		]);
	}
	scenarios(commit?: string): RevisionRegistry['scenarios'] {
		return this.read('SELECT data FROM catalog_scenarios WHERE "commit"=? ORDER BY scenario_id', [
			this.commit(commit)
		]);
	}
	private read<T>(sql: string, bindings: SqliteValue[]): T[] {
		return this.adapter
			.query<{ data: string }>(sql, bindings)
			.map((row) => JSON.parse(row.data) as T);
	}
	private commit(commit?: string): string {
		if (commit) return commit;
		const branch = this.adapter.query<{ head: string }>(
			"SELECT head FROM catalog_branches ORDER BY CASE WHEN id='main' THEN 0 ELSE 1 END, id LIMIT 1"
		)[0];
		return (
			branch?.head ??
			this.adapter.query<{ id: string }>(
				'SELECT id FROM catalog_revisions ORDER BY committed_at DESC, id LIMIT 1'
			)[0]?.id ??
			''
		);
	}
}

export type { CatalogQuery } from './CatalogRepository.types';
