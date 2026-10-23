export interface Impact {
	expanded: boolean;
	units: Record<'direct' | 'indirect' | 'added' | 'removed', string[]>;
	scenarios: { affected: string[] };
	uncertain: unknown[];
	changed: unknown[];
}
