import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { expect, test } from 'vitest';
import { auditProject } from '../src/audit/audit';
import { collectAuditedFiles } from '../src/audit/collect';
import { WorkingTreeAdapter } from '../src/adapters/WorkingTreeAdapter';
import { PerformanceProfileService } from '../src/services/PerformanceProfileService';
import {
	auditAdapters,
	adaptersForProfile,
	resolveAuditProfile
} from '../src/audit/adapters/registry';
import { observedTaskOperation } from './support/taskProfiles';
import { harnessRuleLimits } from '../src/rules/catalog';

test('audit profiles select ecosystem adapters', () => {
	expect(adaptersForProfile('app').map((adapter) => adapter.id)).toEqual([
		'typescript',
		'svelte',
		'sql',
		'shell'
	]);
	expect(adaptersForProfile('dapp').map((adapter) => adapter.id)).toEqual([
		'typescript',
		'svelte',
		'sql',
		'antelope-dapp',
		'cpp',
		'rust',
		'shell',
		'wasm'
	]);
	expect(adaptersForProfile('lib').map((adapter) => adapter.id)).toEqual([
		'typescript',
		'cpp',
		'rust',
		'python',
		'shell',
		'wasm'
	]);
});

test('auto profile detects Svelte apps and Harness libs', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-profile-'));
	try {
		await writeFile(join(root, 'svelte.config.js'), 'export default {};\n');
		expect(resolveAuditProfile(root, 'auto')).toBe('app');
		await mkdir(join(root, 'smart-contract/contracts/example'), { recursive: true });
		expect(resolveAuditProfile(root, 'auto')).toBe('dapp');
		await writeFile(join(root, 'package.json'), '{"harness":{"kind":"lib"}}\n');
		expect(resolveAuditProfile(root, 'auto')).toBe('lib');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('coverage distinguishes audit exclusions from the complete source inventory', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-coverage-'));
	try {
		await mkdir(join(root, 'src'));
		await mkdir(join(root, 'node_modules'));
		await writeFile(join(root, 'src/index.ts'), 'export const value = 1;\n');
		await writeFile(join(root, 'src/component.vue'), '<template />\n');
		await writeFile(join(root, 'node_modules/ignored.ts'), 'export const ignored = true;\n');
		const native = ['ios/App/App/Native.swift', 'android/app/src/main/Native.kt'];
		const generated = [
			'ios/DerivedData/Generated.swift',
			'ios/App/App/public/Generated.js',
			'android/build/Generated.kt',
			'android/app/src/main/assets/Generated.js'
		];
		for (const path of [...native, ...generated, 'public/source.js']) {
			await mkdir(dirname(join(root, path)), { recursive: true });
			await writeFile(join(root, path), '// native source\n');
		}

		const result = await auditProject(root, { profile: 'lib' });

		expect(result.coverage.coveredFiles).toContain('src/index.ts');
		expect(result.coverage.unknownFiles).toContain('src/component.vue');
		expect(result.coverage.ignoredPaths).toContain('node_modules/');
		expect(result.coverage.ignoredPaths).toEqual(expect.arrayContaining(['ios/', 'android/']));
		const tree = new WorkingTreeAdapter(root);
		for (const path of native) expect(await tree.read(path)).toBe('// native source\n');
		const paths = (await tree.list()).map((entry) => entry.path);
		expect(paths).toEqual(expect.arrayContaining([...native, 'public/source.js']));
		for (const path of generated) expect(paths).not.toContain(path);
		expect(paths).not.toContain('node_modules/ignored.ts');
		const profiler = new PerformanceProfileService();
		for (const [unit, operation] of [
			['adapter.working-tree', () => new WorkingTreeAdapter(root).list()],
			['audit.collect', () => collectAuditedFiles(root)]
		] as const)
			await profiler.capture(
				{ unit, workload: 'mixed-platform-source-list', rounds: 3, iterations: 1, warmups: 1 },
				operation
			);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('ecosystem adapters report app and library rule violations', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-ecosystems-'));
	try {
		await mkdir(join(root, 'db/migrations'), { recursive: true });
		await mkdir(join(root, 'src/components'), { recursive: true });
		await mkdir(join(root, 'src/lib/checkout'), { recursive: true });
		await writeFile(join(root, 'src/lib/checkout/payment.ts'), 'export class PaymentService {}\n');
		await mkdir(join(root, 'scripts'), { recursive: true });
		await writeFile(join(root, 'db/migrations/drop_users.sql'), 'DROP TABLE users;\n');
		await writeFile(
			join(root, 'src/components/bad-name.svelte'),
			'<script>let count = 0;</script>\n'
		);
		await writeFile(join(root, 'scripts/run.sh'), 'rm -rf $TARGET\n');

		const appRules = (await auditProject(root, { profile: 'app' })).findings.map(
			(finding) => finding.rule
		);
		const libRules = (await auditProject(root, { profile: 'lib' })).findings.map(
			(finding) => finding.rule
		);

		expect((await auditProject(root, { profile: 'app' })).findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: 'src/lib/checkout/payment.ts', rule: 'file-name-pattern' })
			])
		);
		expect(appRules).toEqual(
			expect.arrayContaining(['sql-dangerous-migration', 'svelte-script-lang'])
		);
		expect(libRules).toEqual(
			expect.arrayContaining(['shell-shebang', 'shell-strict-mode', 'shell-unsafe-rm'])
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test.each([
	['named alias', "export { value as forward } from './value';", true],
	['multiline', "export {\n value as forward,\n type Item\n} from './value';", true],
	['local list', "import { value } from './value';\nexport { value as forward };", true],
	['type clause', "export type { Item as forward } from './value';", false],
	['inline type', "export { type Item as forward } from './value';", false],
	['another name', "export { value as elsewhere } from './value';", false],
	['wildcard', "export * from './value';", false],
	['comment', '// export { value as forward };\nexport const elsewhere = 1;', false],
	['string', 'const text = `export { value as forward };`;\nexport const elsewhere = text;', false]
])('utility runtime naming handles %s', async (_label, source, valid) => {
	const root = await mkdtemp(join(tmpdir(), 'harness-forward-audit-'));
	try {
		await mkdir(join(root, 'src/utils'), { recursive: true });
		await writeFile(
			join(root, 'src/utils/value.ts'),
			'export const value = (input: string) => input;'
		);
		await writeFile(join(root, 'src/utils/forward.ts'), String(source));
		const { findings } = await auditProject(root, { profile: 'lib' });
		const rejected = findings.some(
			(f) => f.path === 'src/utils/forward.ts' && f.rule === 'function-name-pattern'
		);
		expect(
			rejected,
			'explicit runtime forward exports satisfy the utility name; type-only forms do not'
		).toBe(!valid);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test.each([
	[
		'typescript',
		'src/components/bad-name.tsx',
		'export const View = () => null;',
		'react-component-name'
	],
	['svelte', 'src/components/Bad.svelte', '<script>let count = 0;</script>', 'svelte-script-lang'],
	['sql', 'db/migrations/drop_users.sql', 'DROP TABLE users;', 'sql-dangerous-migration'],
	['cpp', 'src/native/bad.hpp', 'using namespace std;', 'cpp-header-namespace'],
	['rust', 'src/main.rs', 'pub fn read() { unsafe { todo!(); } }', 'rust-unsafe-comment'],
	['python', 'scripts/run.py', 'def bad(items=[]):\n    return items', 'python-mutable-default'],
	['shell', 'scripts/run.sh', 'rm -rf $TARGET', 'shell-shebang'],
	['wasm', 'src/module.wasm', 'synthetic artifact bytes', 'wasm-artifact-placement'],
	[
		'antelope-dapp',
		'contracts/token/source/main.cpp',
		'void apply() {}',
		'antelope-contract-workspace'
	]
])('the %s adapter profiles its real rule evaluation', async (id, path, contents, expected) => {
	const adapter = auditAdapters.find((item) => item.id === id)!;
	const lines = contents.split('\n');
	const file = {
		absolutePath: join(tmpdir(), 'harness-rule-fixture', path),
		relativePath: path,
		extension: extname(path),
		contents,
		lines,
		structuralLines: lines,
		limits: harnessRuleLimits,
		size: Buffer.byteLength(contents)
	};
	const findings = await observedTaskOperation(
		`audit.adapters-${id}`,
		'evaluate-representative-rule-violation',
		() =>
			id === 'antelope-dapp'
				? adapter.auditStructure!({ profile: 'dapp', files: [path], dirs: ['contracts/token/'] })
				: adapter.audit(file)
	);
	expect(findings.map((finding) => finding.rule)).toContain(expected);
});
