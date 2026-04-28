import { toKebabCase, toPascalCase } from '../core/case';
import type { PlannedFile } from '../core/files';

export type PieceKind =
	| 'controller'
	| 'service'
	| 'decorator'
	| 'component'
	| 'test'
	| 'feature'
	| 'migration';

export function pieceFiles(kind: PieceKind, name: string): PlannedFile[] {
	if (kind === 'controller') return controllerFiles(name);
	if (kind === 'service') return classFiles('services', name, 'Service');
	if (kind === 'decorator') return classFiles('decorators', name, 'Decorator');
	if (kind === 'component') return componentFiles(name);
	if (kind === 'test') return testFiles(name);
	if (kind === 'feature') return featureFiles(name);
	return migrationFiles(name);
}

function controllerFiles(name: string): PlannedFile[] {
	const className = `${toPascalCase(name)}Controller`;
	const fileName = toKebabCase(name);

	return [
		{
			path: `src/controllers/${className}.ts`,
			contents: `export class ${className} {\n\tasync index(): Promise<Response> {\n\t\treturn Response.json({ ok: true });\n\t}\n}\n`
		},
		{
			path: `test/controllers/${fileName}-controller.test.ts`,
			contents: `import { expect, test } from 'vitest';\nimport { ${className} } from '../../src/controllers/${className}';\n\ntest('${className} index returns ok', async () => {\n\tconst response = await new ${className}().index();\n\texpect(await response.json()).toEqual({ ok: true });\n});\n`
		}
	];
}

function classFiles(folder: string, name: string, suffix: string): PlannedFile[] {
	const className = `${toPascalCase(name)}${suffix}`;
	const fileName = toKebabCase(name);

	return [
		{
			path: `src/${folder}/${className}.ts`,
			contents: `export class ${className} {\n\trun(): string {\n\t\treturn '${fileName}';\n\t}\n}\n`
		},
		{
			path: `test/${folder}/${fileName}.test.ts`,
			contents: `import { expect, test } from 'vitest';\nimport { ${className} } from '../../src/${folder}/${className}';\n\ntest('${className} runs', () => {\n\texpect(new ${className}().run()).toBe('${fileName}');\n});\n`
		}
	];
}

function componentFiles(name: string): PlannedFile[] {
	const componentName = `${toPascalCase(name)}.svelte`;

	return [
		{
			path: `src/components/${componentName}`,
			contents: `<script lang="ts">\n\tlet { label = '${toPascalCase(name)}' }: { label?: string } = $props();\n</script>\n\n<section>\n\t<h2>{label}</h2>\n</section>\n`
		},
		{
			path: `test/components/${toKebabCase(name)}.test.ts`,
			contents: `import { expect, test } from 'vitest';\n\ntest('${componentName} is generated', () => {\n\texpect('${componentName}').toContain('.svelte');\n});\n`
		}
	];
}

function testFiles(name: string): PlannedFile[] {
	const fileName = toKebabCase(name);

	return [
		{
			path: `test/${fileName}.test.ts`,
			contents: `import { expect, test } from 'vitest';\n\ntest('${fileName}', () => {\n\texpect(true).toBe(true);\n});\n`
		}
	];
}

function featureFiles(name: string): PlannedFile[] {
	const title = toPascalCase(name).replace(/([a-z])([A-Z])/g, '$1 $2');

	return [
		{
			path: `specification/features/planned/${toKebabCase(name)}.md`,
			contents: `# Feature: ${title}\n\n## Overview\n\nDescribe the user-facing outcome.\n\n## Acceptance Criteria\n\n- The feature has a measurable completion gate.\n\n## Future Enhancements\n\n- Capture follow-up ideas outside the current scope.\n`
		}
	];
}

function migrationFiles(name: string): PlannedFile[] {
	return [
		{
			path: `db/migrations/${toKebabCase(name)}.sql`,
			contents: `-- ${name}\n-- Keep migrations small and reversible when the database supports it.\n`
		}
	];
}
