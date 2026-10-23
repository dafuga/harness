export interface VerificationTarget {
	scenario: string;
	package: string;
	runner: 'vitest' | 'playwright';
	target: string;
	tests: Record<string, string>;
	states: string[];
}

export interface VerificationScope {
	package: string;
	vitest: Record<string, Record<string, string>>;
	playwright: Record<string, string[]>;
}
