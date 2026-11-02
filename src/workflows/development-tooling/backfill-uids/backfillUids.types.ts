// @harness-uid u_ycgebzbwzx
export interface BackfillOptions {
	root?: string;
	/** Apply the changes; without it the report only says what would change. */
	write?: boolean;
}

export interface BackfillReport {
	/** Active units reviewed. */
	units: number;
	/** Units that were given a uid, with the uid they now hold. */
	assigned: Array<{ id: string; uid: string }>;
	/** Source files that gained an annotation line. */
	annotated: string[];
	/** Units whose files cannot carry a comment: their uid lives in the registry only. */
	registryOnly: string[];
	/** Units left alone because their files disagree about the uid. */
	conflicts: Array<{ id: string; reason: string }>;
	/** Registry files and sources written. */
	written: number;
}
