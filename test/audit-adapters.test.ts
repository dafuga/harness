import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { auditProject } from '../src/audit/audit';
import { adaptersForProfile, resolveAuditProfile } from '../src/audit/adapters/registry';

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

test('coverage reports covered, ignored, and unknown files', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-coverage-'));
	try {
		await mkdir(join(root, 'src'));
		await mkdir(join(root, 'node_modules'));
		await writeFile(join(root, 'src/index.ts'), 'export const value = 1;\n');
		await writeFile(join(root, 'src/component.vue'), '<template />\n');
		await writeFile(join(root, 'node_modules/ignored.ts'), 'export const ignored = true;\n');

		const result = await auditProject(root, { profile: 'lib' });

		expect(result.coverage.coveredFiles).toContain('src/index.ts');
		expect(result.coverage.unknownFiles).toContain('src/component.vue');
		expect(result.coverage.ignoredPaths).toContain('node_modules/');
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
		await writeTypePlacementFixtures(root);
		await mkdir(join(root, 'scripts'), { recursive: true });
		await writeFile(join(root, 'db/migrations/drop_users.sql'), 'DROP TABLE users;\n');
		await writeFile(
			join(root, 'src/components/bad-name.svelte'),
			'<script>let count = 0;</script>\n'
		);
		await writeFile(join(root, 'scripts/run.sh'), 'rm -rf $TARGET\n');

		const appFindings = (await auditProject(root, { profile: 'app' })).findings;
		const appRules = appFindings.map((finding) => finding.rule);
		const libFindings = (await auditProject(root, { profile: 'lib' })).findings;
		const libRules = libFindings.map((finding) => finding.rule);

		expect(
			appFindings.filter((f) => f.rule === 'separate-type-declarations').map((f) => f.path)
		).toEqual([
			'src/components/Payment.svelte',
			'src/lib/checkout/payment.ts',
			'src/utils/runtime.types.ts',
			'src/utils/state.types.ts'
		]);
		expect(
			appFindings.filter((f) =>
				['src/utils/payment.types.ts', 'src/config/paymentConfig.types.ts'].includes(f.path)
			)
		).toEqual([]);
		expect(appFindings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: 'src/lib/checkout/payment.ts', rule: 'file-name-pattern' })
			])
		);
		expect(appRules).toEqual(
			expect.arrayContaining([
				'sql-dangerous-migration',
				'svelte-script-lang',
				'separate-type-declarations'
			])
		);
		expect(libRules).toEqual(
			expect.arrayContaining([
				'shell-shebang',
				'shell-strict-mode',
				'shell-unsafe-rm',
				'separate-type-declarations'
			])
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
	['molecule', '<button>Save</button>', 'atomic-native-element'],
	['organism', '<input aria-label="Name" />', 'atomic-native-element'],
	['', '<p>Content</p>', 'atomic-tier-required'],
	['atom', '<Other />', 'atomic-atom-composition'],
	['molecule', '<!-- <button>example</button> -->{"<input>"}', undefined]
])('Svelte atomic composition admits %s markup faithfully', async (tier, markup, rule) => {
	const root = await mkdtemp(join(tmpdir(), 'harness-atoms-'));
	try {
		await mkdir(join(root, 'src/components'), { recursive: true });
		await writeFile(
			join(root, 'src/components/Example.svelte'),
			`${tier ? `<!-- @harness-tier ${tier} -->` : ''}\n${markup}`
		);
		const { findings } = await auditProject(root, { profile: 'app' });
		const atomic = findings.filter((finding) => finding.rule.startsWith('atomic-'));
		if (rule) expect(atomic.map((finding) => finding.rule)).toContain(rule);
		else expect(atomic).toEqual([]);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

async function writeTypePlacementFixtures(root: string): Promise<void> {
	await mkdir(join(root, 'src/utils'), { recursive: true });
	await mkdir(join(root, 'src/config'), { recursive: true });
	for (const path of ['src/utils/payment.types.ts', 'src/config/paymentConfig.types.ts'])
		await writeFile(join(root, path), 'export interface PaymentInput { value: string }\n');
	await writeFile(join(root, 'src/utils/runtime.types.ts'), 'export const runtime = true;\n');
	await writeFile(join(root, 'src/utils/state.types.ts'), 'export enum State { Ready }\n');
	await writeFile(
		join(root, 'src/lib/checkout/payment.ts'),
		'export interface PaymentInput { value: string }\nexport class PaymentService {}\n'
	);
	await writeFile(
		join(root, 'src/lib/checkout/Payment.types.ts'),
		'export interface PaymentInput { value: string }\n'
	);
	await writeFile(
		join(root, 'src/components/Payment.svelte'),
		'<script lang="ts">type Props = { value: string }; let { value }: Props = $props();</script>'
	);
}
