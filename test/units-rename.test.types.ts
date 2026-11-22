import type { Manifest } from './units-shell-kind.test.types';

export interface Stored extends Manifest {
	uid?: string;
	status: string;
	lineage?: { predecessors: string[] };
	retired?: { reason: string };
}
