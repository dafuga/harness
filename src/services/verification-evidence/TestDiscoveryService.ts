import { runnerDeclarations } from './test-discovery-service/runnerDeclarations';
import { exampleDeclarations } from './test-discovery-service/exampleDeclarations';
import type { SourceTree } from '../../core/development-tooling/sourceTypes';
import type { DiscoveredTest, TestDiscovery } from './TestDiscoveryService.types';

/** Static inventory fails closed on computed cases requiring actual runner discovery. */
export class TestDiscoveryService {
	async discover(tree: Pick<SourceTree, 'read'>, paths: string[]): Promise<TestDiscovery> {
		const tests: DiscoveredTest[] = [],
			errors: string[] = [];
		for (const file of paths) {
			try {
				const text = await tree.read(file);
				tests.push(...this.scan(text, file), ...(await exampleDeclarations(tree, text, file)));
			} catch {
				errors.push(`Cannot read test declarations: ${file}`);
			}
		}
		for (const test of tests) {
			if (test.dynamic)
				errors.push(`${test.file}:${test.line}: computed case requires runner discovery`);
			if (test.disabled)
				errors.push(`${test.file}:${test.line}: skipped, exclusive or todo case is not coverage`);
		}
		return { tests, errors };
	}
	scan(text: string, file: string): DiscoveredTest[] {
		return runnerDeclarations(text, file);
	}
}
export type { DiscoveredTest, TestDiscovery } from './TestDiscoveryService.types';
