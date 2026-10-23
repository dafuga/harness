import type { HarnessUnit } from '../../models/explorer-ui/Harness.types';
import type { ExplorerCategory } from '../../models/explorer-ui/Explorer.types';
import type { ExplorerEntity } from '../../models/explorer-ui/Explorer.types';
import type { ExplorerRelations } from '../../models/explorer-ui/Explorer.types';

export type Edges = Map<string, string[]>;

/** The units reached from one, each once: those of the five kinds, and those of none. */
export interface Reached {
	listed: HarnessUnit[];
	support: HarnessUnit[];
}

/** The active units of one revision and the edges between them both ways, each built once. */
export interface Graph {
	units: Map<string, HarnessUnit>;
	uses: Edges;
	consumers: Edges;
	category(unit: HarnessUnit): ExplorerCategory | null;
}

export type Entity = (unit: HarnessUnit) => ExplorerEntity | null;

/** What an entity contains and what contains it at one revision, asked by its id. */
export type RelationsReader = (id: string) => ExplorerRelations;
