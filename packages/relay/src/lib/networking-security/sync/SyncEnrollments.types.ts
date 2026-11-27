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

export interface EnrollmentView {
	id: string;
	createdAt: number;
	steps: EnrollStep[];
	display?: EnrollmentDisplay;
}

export interface EnrollRow extends Record<string, SqlStorageValue> {
	id: string;
	created_at: number;
	steps: string;
	display: string | null;
}
