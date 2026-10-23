import { posix } from 'node:path';
import type { StoredSide } from '../../../utils/explorer-ui/sideImpact';
import type { Unit } from './SourceArchiveService.types';

/** Direct test imports and authored coverage at this revision; never infer through unrelated units. */
export function associatedTests(
	unit: Unit,
	owned: string[],
	side: StoredSide,
	imports: Map<string, string[]>
): string[] {
	const paths = new Set(owned.flatMap((path) => imports.get(path) ?? []));
	for (const scenario of side.scenarios) {
		if (!scenario.units.includes(unit.id) && !unit.scenarios.includes(scenario.id)) continue;
		for (const test of scenario.tests)
			for (const path of declaredTests(test.target, test.cwd ?? '', side)) paths.add(path);
	}
	return [...paths].sort();
}

/** Index direct imports once per revision, rather than scanning every edge for each unit. */
export function testImporters(side?: StoredSide): Map<string, string[]> {
	const imports = new Map<string, string[]>();
	for (const [from, to] of side?.edges ?? []) {
		const test = side!.nodes[from],
			target = side!.nodes[to];
		if (test[1] !== 'test' || !target[0].startsWith('file:')) continue;
		const path = test[0].slice(5),
			source = target[0].slice(5);
		if (!/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)) continue;
		const found = imports.get(source) ?? [];
		found.push(path);
		imports.set(source, found);
	}
	return imports;
}

/** Resolve literal tracked test addresses in commands without executing or expanding a shell. */
function declaredTests(target: string, cwd: string, side: StoredSide): string[] {
	const tests = side.nodes.filter(([, kind]) => kind === 'test').map(([id]) => id.slice(5));
	const tokens = [...target.matchAll(/"([^"]+)"|'([^']+)'|([^\s;&|()]+)/g)].map(
		(match) => match[1] ?? match[2] ?? match[3]
	);
	return tokens.flatMap((token) => {
		const resolved = posix.normalize(posix.join(cwd, token));
		if (tests.includes(resolved)) return [resolved];
		if (token.includes('/') || !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(token)) return [];
		const matches = tests.filter(
			(path) => (!cwd || path.startsWith(cwd + '/')) && posix.basename(path) === token
		);
		return matches.length === 1 ? matches : [];
	});
}
