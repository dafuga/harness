export type MiraAsset = {
	number: number;
	file: string;
	caption: string;
	category: string;
	source?: string;
	capturedAt?: string;
};

export type MiraFinding = { id: string; status: string; detail: string };
