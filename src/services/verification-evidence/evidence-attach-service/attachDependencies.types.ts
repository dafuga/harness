// @harness-uid u_q33nfdq3id
export interface DependentRecord {
	id: string;
	source: { baseRecord?: string | null };
	scenarios: { referencedRecord?: string | null }[];
	failures: string[];
}
