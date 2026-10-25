import type { RegressionRecord } from '../../src/core/regressionTypes';
import type { ComponentManifest } from '../../src/core/unitTypes';
export interface AuthoredFixtureInput {
	unit: string;
	path: string;
	blob: string;
	sha256: string;
}
export interface FrozenFixtureInputs {
	inputs: { path: string; hash: string }[];
	expectations: AuthoredFixtureInput[];
}
export interface RegressionInputFixture {
	root: string;
	red: RegressionRecord & { expectations: AuthoredFixtureInput[] };
	unit: ComponentManifest;
	commit: (changes: Record<string, string>) => Promise<string>;
	close: () => Promise<void>;
	git: (args: string[]) => Promise<string>;
}
export interface RegressionInputExample {
	fixture: string;
}

export interface FixtureRecordInput {
	git: RegressionInputFixture['git'];
	unit: ComponentManifest;
	commit: string;
	inputs: FrozenFixtureInputs['inputs'];
}
