export type Spawn = (command: string[], options: unknown) => unknown;

export interface Launch {
	spawned: string[][];
	exitCode?: number;
	error?: string;
}
