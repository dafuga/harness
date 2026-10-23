import type { ObservationValue } from './verificationValues';

export interface AssertionObservation {
	schemaVersion: 1;
	kind: 'matcher';
	invocation: string;
	testName: string;
	matcher: string;
	modifiers: string[];
	actual: ObservationValue;
	expected: ObservationValue[];
	passed: boolean;
	error?: ObservationValue;
}

export interface Context {
	testName: string;
	observed: { value: unknown };
	modifiers: string[];
	poll?: boolean;
}
