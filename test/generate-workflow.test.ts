import ts from 'typescript';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { generateModel, generatePiece } from '../src/workflows/generate-code/generateCode';
import { scaffoldDetails, scaffoldKinds } from '../src/templates/scaffoldTypes';

test('lib generation auto-exports package-safe scaffolds', async () => {
	const root = await libProject();

	await generatePiece({ root, kind: 'service', name: 'PublishPost' });
	await generatePiece({ root, kind: 'mailer', name: 'Welcome' });
	await generatePiece({ root, kind: 'concern', name: 'Publishable' });
	await generatePiece({ root, kind: 'config', name: 'Search' });
	await generatePiece({ root, kind: 'helper', name: 'FormatPostTitle' });
	await generateModel({ root, name: 'Post', rawFields: ['title:string'], adapter: 'sqlite' });
	const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
	expect(manifest.dependencies['@dafuga01/harness']).toBe('^0.1.4');

	const index = await readFile(join(root, 'src/index.ts'), 'utf8');
	expect(index).toContain("export { PublishPostService } from './services/PublishPostService';");
	expect(index).toContain("export { WelcomeMailer } from './mailers/WelcomeMailer';");
	expect(index).toContain("export { withPublishable } from './concerns/withPublishable';");
	expect(index).toContain("export { searchConfig } from './configs/searchConfig';");
	expect(await readFile(join(root, 'src/configs/searchConfig.ts'), 'utf8')).toContain(
		'export const searchConfig'
	);
	expect(index).toContain("export { formatPostTitle } from './helpers/formatPostTitle';");
	expect(index).toContain("export { Post } from './models/Post';");
	expect(index).toContain('export type { PostAttributes, PostCreateInput, PostUpdateInput }');
	await rm(root, { recursive: true, force: true });
});

test('app-only scaffolds fail in lib projects', async () => {
	const root = await libProject();

	await expect(generatePiece({ root, kind: 'view', name: 'Dashboard' })).rejects.toThrow(
		'only available in Harness app projects'
	);
	await rm(root, { recursive: true, force: true });
});

test('app generation allows app-only scaffolds without package exports', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-generate-'));
	await writeFile(join(root, 'package.json'), JSON.stringify({ harness: { kind: 'app' } }));

	const result = await generatePiece({ root, kind: 'view', name: 'Dashboard' });

	expect(result.writes.map((file) => file.path)).toContain('src/routes/dashboard/+page.svelte');
	expect(result.exportsUpdated).toBe(false);
	const page = await readFile(join(root, 'src/routes/dashboard/+page.svelte'), 'utf8');
	expect(page).toContain('@harness-tier page');
	expect(page).toContain('<HtmlH1>');
	await generatePiece({ root, kind: 'component', name: 'PostCard' });
	const component = await readFile(join(root, 'src/components/PostCard.svelte'), 'utf8');
	expect(component).toContain('@harness-tier molecule');
	expect(component).toContain('<HtmlSection');
	const button = await readFile(join(root, 'src/components/atoms/HtmlButton.svelte'), 'utf8');
	expect(button).toContain('@harness-element button');
	const input = await readFile(join(root, 'src/components/atoms/HtmlInput.svelte'), 'utf8');
	expect(input).toContain('@harness-element input');
	await rm(root, { recursive: true, force: true });
});

async function libProject(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), 'harness-generate-'));
	await mkdir(join(root, 'src'), { recursive: true });
	await writeFile(join(root, 'src/index.ts'), '');
	await writeFile(join(root, 'package.json'), JSON.stringify({ harness: { kind: 'lib' } }));
	return root;
}

test('generation keeps category folders, imports and package exports in agreement', async () => {
	const root = await libProject();
	try {
		await writeFile(
			join(root, 'harness.groups.json'),
			JSON.stringify({
				schemaVersion: 1,
				groups: [
					{
						id: 'verification-evidence',
						title: 'Verification & evidence',
						terms: ['budget', 'proof']
					}
				]
			})
		);
		const grouped = { root, group: 'verification-evidence' };
		for (const kind of ['service', 'repository', 'adapter', 'util', 'config', 'helper'] as const) {
			const name = kind === 'helper' ? 'FormatProofLabel' : 'Proof';
			const result = await generatePiece({ ...grouped, kind, name });
			expect(
				result.writes.some(
					(file) => file.path.startsWith(`src/`) && file.path.includes('/verification-evidence/')
				)
			).toBe(true);
		}
		await generateModel({
			...grouped,
			name: 'Proof',
			rawFields: ['name:string'],
			adapter: 'sqlite'
		});
		await generatePiece({ root, kind: 'service', name: 'BudgetLedger' });
		const index = await readFile(join(root, 'src/index.ts'), 'utf8');
		expect(index).toContain("from './services/verification-evidence/ProofService'");
		expect(index).toContain("from './models/verification-evidence/Proof'");
		expect(index).toContain("from './services/verification-evidence/BudgetLedgerService'");
		const testFile = await readFile(
			join(root, 'test/services/verification-evidence/proof.test.ts'),
			'utf8'
		);
		expect(testFile).toContain('../../../src/services/verification-evidence/ProofService');
		const model = await readFile(join(root, 'src/models/verification-evidence/Proof.ts'), 'utf8');
		expect(model).toContain("from '../adapters/types'");
		await expect(generatePiece({ root, kind: 'service', name: 'Mystery' })).rejects.toThrow(
			'--group'
		);
		await expect(
			generatePiece({ ...grouped, kind: 'service', name: 'Proof', group: '../escape' })
		).rejects.toThrow();
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('the same category works for every source scaffold and can be extended', async () => {
	const root = await libProject();
	try {
		const sources = scaffoldKinds.filter(
			(kind) => !['test', 'e2e', 'feature', 'migration'].includes(kind)
		);
		/** Game pieces are refused outside game projects, so they use the same category in one. */
		for (const harness of [{ kind: 'app' }, { kind: 'game', dimension: '2d' }]) {
			await writeFile(join(root, 'package.json'), JSON.stringify({ harness }));
			for (const kind of sources.filter(
				(kind) => !!scaffoldDetails[kind].gameOnly === (harness.kind === 'game')
			)) {
				const result = await generatePiece({
					root,
					kind,
					name: `${kind}Example`,
					group: 'commerce'
				});
				for (const file of result.writes.filter((file) => file.path.endsWith('.ts'))) {
					const text = await readFile(join(root, file.path), 'utf8');
					const tree = ts.createSourceFile(file.path, text, ts.ScriptTarget.Latest);
					const declarations = tree.statements.filter(
						(node) => ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
					);
					const runtime = tree.statements.some(
						(node) =>
							ts.isClassDeclaration(node) ||
							ts.isFunctionDeclaration(node) ||
							ts.isVariableStatement(node)
					);
					expect(runtime && declarations.length > 0, file.path + ' separates named types').toBe(
						false
					);
				}
				expect(
					result.writes.some(
						(file) =>
							/^(?:src|db)\//.test(file.path) && /\/(?:\(commerce\)|commerce)\//.test(file.path)
					),
					kind
				).toBe(true);
			}
		}
		await generatePiece({ root, kind: 'service', name: 'Login', group: 'identity' });
		const config = JSON.parse(await readFile(join(root, 'harness.groups.json'), 'utf8'));
		expect(config.groups.map((group: { id: string }) => group.id)).toEqual([
			'commerce',
			'identity'
		]);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
