// @harness-uid u_f44y6xqi3p
export interface LayerEdge {
	from: string;
	to: string;
	todo: string;
}

export type ReuseBaseline = Record<string, number>;

export type TemporaryCallBaseline = Record<string, number>;

export interface TemporaryCallNames {
	fsModules: Set<string>;
	tempNames: Set<string>;
	directNames: Set<string>;
	namespaceNames: Set<string>;
}
