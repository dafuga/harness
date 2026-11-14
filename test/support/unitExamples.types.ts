import type {
	UnitDocumentation,
	UsageExample
} from '../../src/utils/unit-documentation/unitDocumentation';

export interface DeclaredHelperExamples {
	symbol: string;
	source: string;
	examples: UsageExample[];
}

export interface DeclaredItemExamples {
	name: string;
	type: string;
	examples: unknown[];
}

export interface DeclaredExamples {
	helpers: DeclaredHelperExamples[];
	documentation: UnitDocumentation | undefined;
	items: DeclaredItemExamples[];
}

export type ObservedUsageExample =
	| { name: string; input: unknown; output: unknown }
	| { name: string; input: unknown; error: unknown };
