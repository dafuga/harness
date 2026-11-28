export type LaneEnvironment = Record<string, string | undefined>;

export type LaneHost = {
	directory: string;
	cores: number;
	load: () => number[];
};
