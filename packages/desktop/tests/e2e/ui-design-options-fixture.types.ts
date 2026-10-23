import type { colors, options } from './ui-design-options-fixture';

export type OptionId = keyof typeof colors;

export type Item = Record<string, unknown>;

export interface Entity extends Item {
	id: string;
	versions: Item[];
	threads: Item[];
}

export interface Host {
	harness: Record<string, unknown>;
	__emitRun: (event: Item) => void;
	__projects: {
		data: {
			image: number[];
			projects: Array<{ entities: Entity[]; messages: Record<string, Item[]> }>;
		};
		own: (op: string, input?: Item) => { entities: Entity[] };
	};
}

export interface Seed {
	options: typeof options;
	tip: string;
	legacy: string;
	thread: string;
}
