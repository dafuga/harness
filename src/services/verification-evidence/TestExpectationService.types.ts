import type { UsageExample } from '../../utils/explorer-ui/unit-documentation/unitDocumentation.types';
export interface ExampleObservation {
	name: string;
	input: unknown;
	output?: unknown;
	error?: unknown;
}
export type ExampleInvocation = (input: UsageExample['input']) => unknown | Promise<unknown>;
export type ExampleRegistrar = (title: string, run: () => Promise<void>) => unknown;
export type ExampleFunctions = Record<string, (...input: never[]) => unknown>;
