import { ESLint } from 'eslint';
import { format } from 'prettier';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import type { PlannedFile } from '../../../src/core/development-tooling/files';
import { builtinModules } from '../../../src/templates/module-system/builtinModules';
import { expect } from '../../verificationExpect';
import { measureWorkload } from '../measureWorkload';

/** Validate real emitted foundations with generated lint rules in a minimal typed source project. */
export async function assertFoundationLint(project: PlannedFile[], kind: string): Promise<void> {
	const root = await mkdtemp(join(tmpdir(), 'harness-foundation-lint-'));
	try {
		const sources = await writeProject(root, project);
		const eslint = new ESLint({
			cwd: root,
			overrideConfigFile: join(root, 'eslint.config.js'),
			overrideConfig: { languageOptions: { parserOptions: { tsconfigRootDir: root } } }
		});
		const results = await measureWorkload(
			'template.module-system-browser-testing-files',
			`lint-${kind}-testing-foundations`,
			() =>
				measureWorkload(
					'template.module-system-audio-testing-files',
					`lint-${kind}-testing-foundations`,
					() => eslint.lintFiles(sources)
				)
		);
		expect(
			results.flatMap((result) =>
				result.messages
					.filter((message) => message.severity === 2)
					.map((message) => ({
						file: relative(root, result.filePath),
						rule: message.ruleId,
						message: message.message
					}))
			),
			'Generated testing foundations satisfy their project lint rules'
		).toEqual([]);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

async function writeProject(root: string, project: PlannedFile[]): Promise<string[]> {
	const foundations = builtinModules
		.filter((module) => module.testing)
		.flatMap((module) => module.setup)
		.filter((file) => file.path.startsWith('src/'));
	const options = JSON.parse(project.find((file) => file.path === '.prettierrc')!.contents);
	const config = project.filter((file) =>
		['package.json', 'eslint.config.js', 'eslint.harness-rules.js', 'harness.audit.json'].includes(
			file.path
		)
	);
	const files = [
		...config,
		...foundations,
		{
			path: 'tsconfig.json',
			contents: JSON.stringify({
				compilerOptions: {
					target: 'ES2022',
					module: 'ESNext',
					moduleResolution: 'Bundler',
					strict: true,
					skipLibCheck: true
				},
				include: ['src/**/*.ts']
			})
		}
	];
	await symlink(resolve('node_modules'), join(root, 'node_modules'), 'dir');
	for (const file of files) {
		await mkdir(dirname(join(root, file.path)), { recursive: true });
		await writeFile(
			join(root, file.path),
			await format(file.contents, { ...options, filepath: file.path })
		);
	}
	return foundations.map((file) => join(root, file.path));
}
