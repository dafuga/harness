// @harness-uid u_ex57mq5k4r
export interface EnrollStep {
	n: number;
	/** The device that wrote the step: the new one for step 0, an approver later. */
	by: string;
	/** The step as the client wrote it. The object never reads it. */
	body: string;
}

export interface EnrollmentDisplay {
	platform: 'iphone' | 'mac' | 'web';
	country?: string;
}

export type EnrollmentDecision =
	| { kind: 'deny' }
	| { kind: 'publish'; hash: string; recipient: string; kemPublic: string; signingPublic: string };

export interface EnrollmentAuthor {
	device: string;
	owner?: string;
}

export interface EnrollmentView {
	id: string;
	createdAt: number;
	steps: EnrollStep[];
	display?: EnrollmentDisplay;
	decision?: string;
	/** Hub-derived installation and requesting session binding. Never sent to an app. */
	owner?: string;
}

export interface EnrollRow extends Record<string, SqlStorageValue> {
	id: string;
	created_at: number;
	steps: string;
	display: string | null;
	decision: string | null;
	owner: string | null;
}
