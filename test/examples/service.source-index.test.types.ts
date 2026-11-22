import type { SourceLanguage } from '../../src/utils/development-tooling/scanImports.types';

export type ExecutionCase = [
	name: string,
	code: string,
	language: SourceLanguage,
	path: string,
	expected: string
];
