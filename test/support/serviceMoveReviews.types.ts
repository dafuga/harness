export interface ReviewedFile {
	unit: string;
	from: string;
	to: string;
	definition: string;
	relocationDefinition?: string;
	review?: { commit: string; path: string; definition: string; reason: string };
}

export interface Ledger {
	originalProof?: string;
	moves: Record<string, string>;
	files: ReviewedFile[];
}

export type Git = (args: string[]) => string;
