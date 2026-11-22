import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { moduleCategoryFindings } from '../src/audit/development-tooling/structure-rules/moduleCategoryFindings';
import registry from '../scripts/verification-forward-registry.json';
import { checkVerificationForwards } from '../scripts/check-verification-forwards';
import { withTempDir } from './support/temporary';

test('registered public forwards resolve to canonical files and retain their registered IDs', () => {
	expect(checkVerificationForwards(process.cwd())).toEqual([]);
	expect(
		moduleCategoryFindings({
			root: process.cwd(),
			profile: 'lib',
			files: registry.forwards.map(({ path }) => path),
			dirs: []
		}),
		'Registered verification forwards pass the module category audit'
	).toEqual([]);
});

test('the guard catches a forward that stops resolving to its registered canonical target', async () => {
	await withTempDir('harness-forward-guard-', async (root) => {
		const source = join(root, 'src/workflows/run-verify/forward.ts');
		const target = join(root, 'src/workflows/verification-evidence/run-verify/verify.ts');
		const other = join(root, 'src/workflows/other.ts');
		const registry = join(root, 'scripts/verification-forward-registry.json');
		await mkdir(join(root, 'src/workflows/run-verify'), { recursive: true });
		await mkdir(join(root, 'src/workflows/verification-evidence/run-verify'), { recursive: true });
		await mkdir(join(root, 'scripts'), { recursive: true });
		await writeFile(
			source,
			'// @harness-uid u_fixture\nexport * from "../verification-evidence/run-verify/verify";\n'
		);
		await writeFile(
			target,
			'// @harness-uid u_fixture\nexport const verify = true;\nexport * from "../../other";\n'
		);
		await writeFile(other, '// @harness-uid u_other\nexport const helper = false;\n');
		const entry = {
			path: 'src/workflows/run-verify/forward.ts',
			target: 'src/workflows/verification-evidence/run-verify/verify.ts',
			uid: 'u_fixture',
			status: 'deprecated'
		};
		await writeFile(registry, JSON.stringify({ schemaVersion: 1, forwards: [entry] }));
		expect(checkVerificationForwards(root)).toEqual([]);
		await writeFile(
			source,
			'// @harness-uid u_fixture\nexport * from "../verification-evidence/run-verify/verify";\nexport function hidden() { return true; }\n'
		);
		expect(checkVerificationForwards(root)).toContain(
			`${entry.path} contains runtime implementation; deprecated forwards may contain only type declarations and export declarations`
		);
		await writeFile(source, '// @harness-uid u_fixture\nexport * from "../other";\n');
		expect(checkVerificationForwards(root)).toContain(
			`${entry.path} resolves to src/workflows/other.ts, not ${entry.target}`
		);
		await writeFile(source, '// @harness-uid u_fixture\nexport * from "./cycle";\n');
		await writeFile(
			join(root, 'src/workflows/run-verify/cycle.ts'),
			'export * from "./forward";\n'
		);
		expect(checkVerificationForwards(root).some((issue) => issue.includes('cyclic forward'))).toBe(
			true
		);
	});
});
