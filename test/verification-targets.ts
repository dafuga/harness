import type { VerificationScope, VerificationTarget } from './verification-targets.types';
import { resolve } from 'node:path';
import { scopes } from './verification-scopes';

export function verificationTarget(
	scenario: string,
	runner: string,
	target: string,
	cwd: string
): VerificationTarget {
	const scope = scopes[scenario];
	const tests = runner === 'vitest' ? scope?.vitest[target] : undefined;
	let states = tests ? [...new Set(Object.values(tests))] : undefined;
	if (runner === 'playwright') states = scope?.playwright[target];
	if (!scope || !states || !atVerificationPackage(scope, cwd))
		throw new Error('Unknown verification scenario, runner, target or package');
	return {
		scenario,
		package: scope.package,
		runner: runner as 'vitest' | 'playwright',
		target,
		tests: tests ?? {},
		states
	};
}

/** Root evidence belongs to this checkout; workspace evidence retains its declared package. */
function atVerificationPackage(scope: VerificationScope, cwd: string): boolean {
	if (scope.package === 'root') return resolve(cwd) === resolve(import.meta.dirname, '..');
	return cwd.replaceAll('\\', '/').endsWith(`/packages/${scope.package}`);
}

export type { VerificationTarget, VerificationScope } from './verification-targets.types';
