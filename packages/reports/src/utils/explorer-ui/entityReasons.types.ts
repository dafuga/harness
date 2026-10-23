export interface BoundedText {
	text: string;
	/** True when the text is only the start of what was written. */
	cut: boolean;
}

export type ReasonKind = 'simplification' | 'performance';

export interface ReasonAttempts extends BoundedText {
	/** Each outcome the attempts of this kind had, once. */
	outcomes: string[];
}

export interface ReasonUse {
	subject: string;
	kind: ReasonKind;
	outcome: string;
}

export interface EntityReasons {
	behavior: BoundedText;
	simplification: ReasonAttempts;
	performance: ReasonAttempts;
	/** Every behaviour note as it was written, each once, with what it was written about. */
	notes: Array<{ behavior: string; subjects: string[] }>;
	/** Every attempt as it was written, each once, with the outcome it had for each subject. */
	attempted: Array<{ attempt: string; uses: ReasonUse[] }>;
	/** True when the summary says less than the reasons do, so they are offered in full. */
	long: boolean;
}
