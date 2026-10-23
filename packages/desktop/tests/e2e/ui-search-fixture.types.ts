export type Entity = Record<string, unknown>;

/** An entity added to one synthetic project, at both commits or at only one of them. */
export interface Added {
	project: number;
	id: string;
	category: string;
	kind: string;
	title: string;
	summary: string;
	at?: 'tip' | 'earlier';
}
