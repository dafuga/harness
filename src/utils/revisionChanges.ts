

export type Kind = 'direct' | 'added' | 'removed';

/** The part of a stored registry that says which units a revision has, and in which version. */
export interface UnitVersions {
	available: boolean;
	units: Array<{ id: string; version: string }>;
}

/** The part of a stored source impact that names units. */
export interface ChangedUnits {
	base: string | null;
	units: Record<Kind | 'indirect', string[]>;
}

/** The units a commit changed itself, against its first parent. */
export interface RevisionChanges {
	/** The first parent the commit was compared with; null for a commit that has none. */
	base: string | null;
	/** Units whose own source, contract or dependencies differ. */
	direct: string[];
	added: string[];
	removed: string[];
}

export interface ChangesInput {
	impact: ChangedUnits | null;
	registry: UnitVersions;
	/** The registry of the first parent, when the same build holds it. */
	parent: UnitVersions | undefined;
	/** The first parent, for when no impact states it. */
	base?: string | null;
}

export { revisionChanges } from '../services/history-index-service/revisionChanges';
