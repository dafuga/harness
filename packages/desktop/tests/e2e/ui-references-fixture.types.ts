import type { named } from './ui-references-fixture';

export type Entity = Record<string, unknown>;

export interface Seed {
	named: typeof named;
	question: string;
	remark: string;
	threads: { alpha: string; gamma: string };
}

export interface ReferenceHost {
	harness: Record<string, unknown>;
	__emitRun: (event: Record<string, unknown>) => void;
	__projects: {
		data: { projects: Array<{ entities: Entity[]; messages: Record<string, Entity[]> }> };
		own: (op: string, input: Entity) => unknown;
	};
}
