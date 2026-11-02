// @harness-uid u_pkkwgy423v
export interface Block {
	kind: 'type' | 'func';
	name: string;
	start: number;
	depth: number;
	inType: boolean;
}
