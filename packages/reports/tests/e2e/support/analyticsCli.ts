import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fixtures } from './fixtures';

const cli = resolve('../../src/index.ts');

/**
 * Asks the analytics command line of the checkout under test about the analytics store of this
 * run, and returns what it prints as structured results. The dashboard that showed these figures
 * is gone; the command line is where they are still read.
 */
export function analytics<Result>(command: string, ...options: string[]): Result {
	const printed = execFileSync('bun', [cli, 'analytics', command, '--json', ...options], {
		encoding: 'utf8',
		env: { ...process.env, HARNESS_ANALYTICS_HOME: fixtures.analytics }
	});
	return JSON.parse(printed) as Result;
}

export interface FirstTry {
	checks: number;
	firstTry: { numerator: number; denominator: number; rate: number | null };
	tasks: Array<{ task: string; agentModel: string; firstPassed: boolean; report?: string }>;
}
export interface Assessments {
	response: FirstTry;
	cleanCode: FirstTry;
}
export interface Models {
	models: {
		authors: Record<string, number>;
		evaluators: Record<string, number>;
		firstTryByAuthor: Record<string, Assessments>;
	};
}
