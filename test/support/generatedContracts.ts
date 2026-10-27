import { expect } from 'vitest';
import ts from 'typescript';
import { resolve } from 'node:path';
import { pieceFiles } from '../../src/templates/pieces';
import { TestDiscoveryService } from '../../src/services/verification-evidence/TestDiscoveryService';

export function assertAppPieceContracts() {
	assertComponentContract();
	assertPageContract();
	assertLayoutContract();
	assertPartialContract();
	assertAppBehavior();
}

function assertComponentContract() {
	const component = pieceFiles('component', 'StatusBadge');
	const componentSource = component.find((file) => file.path.endsWith('StatusBadge.svelte'));
	const componentPreview = component.find((file) => file.path.includes('__harness/components'));
	const componentTest = component.find((file) => file.path.endsWith('-component.spec.ts'));
	expect(component.map((file) => file.path)).toContain(
		'src/routes/__harness/components/status-badge/+page.svelte'
	);
	expect(componentSource?.contents).not.toContain('Toggle details');
	expect(componentSource?.contents).toContain('error?: string');
	expect(componentTest?.contents).toContain("id: 'label-prop'");
	expect(componentTest?.contents).toContain("id: 'error-prop'");
	expect(componentTest?.contents).toContain('desktop');
	expect(componentTest?.contents).toContain('matchScreenshot');
	expect(componentTest?.contents).toContain('state.screenshot[viewport.id]');
	assertVisualCases(componentTest?.contents, 'StatusBadge.svelte states', [
		'rest',
		'label-prop',
		'error-prop'
	]);
	expect(componentPreview?.contents).toContain("import.meta.env.MODE !== 'test'");
}

function assertPageContract() {
	expect(pieceFiles('view', 'BlogPost').map((file) => file.path)).toContain(
		'src/routes/blog-post/+page.svelte'
	);
	const viewTest = pieceFiles('view', 'BlogPost').find((file) =>
		file.path.endsWith('-page.spec.ts')
	);
	expect(viewTest?.contents).toContain('state.screenshot[viewport.id]');
	expect(viewTest?.contents).toContain('fullPage: true');
	expect(viewTest?.contents).toContain("id: 'error-state'");
	assertVisualCases(viewTest?.contents, 'blog-post view route is generated', [
		'default',
		'error-state'
	]);
	const e2eTest = pieceFiles('e2e', 'BlogPost').find((file) =>
		file.path.endsWith('blog-post-page.spec.ts')
	);
	expect(e2eTest?.contents).toContain('state.screenshot[viewport.id]');
	expect(e2eTest?.contents).toContain('fullPage: true');
	expect(e2eTest?.contents).toContain("from './support/browserTest'");
	expect(e2eTest).toEqual(viewTest);
	const resourcePaths = pieceFiles('resource', 'BlogPost').map((file) => file.path);
	expect(new Set(resourcePaths).size).toBe(resourcePaths.length);
}

function assertLayoutContract() {
	const layout = pieceFiles('layout', 'BlogPost');
	expect(layout.map((file) => file.path)).toContain('src/routes/blog-post/+layout.svelte');
	expect(layout.map((file) => file.path)).toContain('src/routes/blog-post/__harness/+page.svelte');
	const layoutTest = layout.find((file) => file.path.endsWith('-layout.spec.ts'));
	expect(layoutTest?.contents).toContain('[data-harness-layout="blog-post"]');
	expect(layoutTest?.contents).toContain('state.screenshot[viewport.id]');
	expect(layoutTest?.contents, 'Layouts use the page screenshot form').toContain(
		'matchScreenshot(page,'
	);
	expect(layoutTest?.contents).toContain('fullPage: true');
	expect(layoutTest?.contents).toContain(
		'layout.locator(\'[data-harness-layout-content="blog-post"]\')'
	);
	expect(layoutTest?.contents).toContain("toContainText('Child content placeholder')");
	expect(layout.find((file) => file.path.endsWith('/__harness/+page.svelte'))?.contents).toContain(
		'Child content placeholder'
	);
	expect(layout.find((file) => file.path.endsWith('/+layout.svelte'))?.contents).toContain(
		'{@render children()}'
	);
}

function assertPartialContract() {
	const partial = pieceFiles('partial', 'PostCard');
	expect(partial.map((file) => file.path)).toContain(
		'src/routes/__harness/partials/post-card/+page.svelte'
	);
	const partialTest = partial.find((file) => file.path.endsWith('-partial.spec.ts'));
	expect(partialTest?.contents).toContain('[data-harness-partial="post-card"]');
	expect(partialTest?.contents).toContain('toHaveText(state.label');
	assertVisualCases(partialTest?.contents, 'PostCardPartial.svelte states', ['rest', 'label-prop']);
}

export function assertVisualCases(
	source: string | undefined,
	suite: string,
	states: string[]
): void {
	expect(source).toBeDefined();
	const found = new TestDiscoveryService().scan(source!, 'generated.spec.ts');
	const expected = ['desktop', 'tablet', 'mobile'].flatMap((viewport) =>
		states.map((state) => ({ title: `${suite} > ${viewport} viewport > ${state}`, dynamic: false }))
	);
	expect(
		found.map(({ title, dynamic }) => ({ title, dynamic })),
		'Generated visual case identities must be statically discoverable'
	).toEqual(expected);
}

function assertAppBehavior() {
	expect(pieceFiles('api', 'BlogPost').map((file) => file.path)).toContain(
		'src/routes/api/blog-post/+server.ts'
	);
	const apiTest = pieceFiles('api', 'BlogPost').find((file) => file.path.endsWith('-api.test.ts'));
	expect(apiTest?.contents).toContain('test.each(cases)');
	expect(apiTest?.contents).toContain("contentType: 'application/json'");
	expect(apiTest?.contents).toContain("id: 'error prop returns complete JSON'");
	const storeTest = pieceFiles('store', 'Draft').find((file) => file.path.endsWith('.test.ts'));
	expect(storeTest?.contents).toContain('test.each(cases)');
	expect(storeTest?.contents).toContain('store.value = nextValue');
	const hookTest = pieceFiles('hook', 'auth').find((file) => file.path.endsWith('.test.ts'));
	expect(hookTest?.contents).toContain('passes the event to resolve');
	expect(hookTest?.contents).toContain('resolves.toBe(response)');
	expect(hookTest?.contents).not.toContain('toBeTypeOf');
}

export function assertClassMatrices() {
	assertRepositoryTypes();
	for (const [kind, count] of Object.entries({
		mailer: 1,
		channel: 4,
		form: 6,
		middleware: 1,
		helper: 3,
		concern: 2,
		initializer: 3,
		repository: 4,
		adapter: 3,
		validator: 1,
		serializer: 1,
		policy: 1,
		util: 3,
		seeder: 1
	})) {
		const emitted = pieceFiles(kind as Parameters<typeof pieceFiles>[0], 'Post').find((file) =>
			file.path.endsWith('.test.ts')
		)!.contents;
		expect((emitted.match(/\btest\('/g) ?? []).length, kind).toBe(count);
		expect(emitted, kind).not.toContain('toBeInstanceOf');
		expect(emitted, kind).toContain('// =>');
	}
}

/** The generated method-state examples are also compiler inputs, not only formatted text. */
function assertRepositoryTypes() {
	const root = resolve('.cache/harness/virtual-repository-example');
	const files = new Map(
		pieceFiles('repository', 'Compile').map((file) => [resolve(root, file.path), file.contents])
	);
	const options: ts.CompilerOptions = {
		target: ts.ScriptTarget.ESNext,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		strict: true,
		skipLibCheck: true,
		noEmit: true,
		types: []
	};
	const host = ts.createCompilerHost(options);
	const read = host.readFile,
		exists = host.fileExists,
		source = host.getSourceFile;
	const directory = host.directoryExists!;
	host.readFile = (name) => files.get(resolve(name)) ?? read(name);
	host.fileExists = (name) => files.has(resolve(name)) || exists(name);
	host.directoryExists = (name) => name.startsWith(root) || directory(name);
	host.getSourceFile = (name, language, ...rest) => {
		const text = files.get(resolve(name));
		return text === undefined
			? source(name, language, ...rest)
			: ts.createSourceFile(name, text, language, true);
	};
	const program = ts.createProgram([...files.keys()], options, host);
	// => [] Every emitted repository example must compile with its authored inputs.
	expect(
		ts
			.getPreEmitDiagnostics(program)
			.map((issue) => ts.flattenDiagnosticMessageText(issue.messageText, '\n')),
		'Generated repository method-state cases compile'
	).toEqual([]);
}
