export interface Impact {
	expanded: boolean;
	units: Record<'direct' | 'indirect' | 'added' | 'removed', string[]>;
	scenarios: { affected: string[] };
	uncertain: Array<{ node: string; reason: string }>;
	changed: Array<{ path: string; status: string }>;
}

export interface Detail {
	comparison: unknown;
	records: unknown[];
	sourceImpact: {
		base: string | null;
		expanded: boolean;
		units: Impact['units'];
		scenarios: string[];
		uncertain: Impact['uncertain'];
		changed: Impact['changed'];
	} | null;
}

export interface Listed {
	commit: string;
	changes?: { base: string | null; direct: string[]; added: string[]; removed: string[] } | null;
}
