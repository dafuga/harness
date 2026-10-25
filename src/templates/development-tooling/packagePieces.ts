import type { EntityFileInput } from './packagePieces.types';
import { toCamelCase, toKebabCase, toPascalCase } from '../../helpers/strings/case';
import type { PlannedFile } from '../../core/development-tooling/files';

export function controllerFiles(name: string): PlannedFile[] {
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

export function classFiles(folder: string, name: string, suffix: string): PlannedFile[] {
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

export function repositoryFiles(name: string): PlannedFile[] {
	const className = `${toPascalCase(name)}Repository`;
	const fileName = toKebabCase(name);

	return entityFiles({
		folder: 'repositories',
		fileName,
		className,
		contents: repositoryContents(className),
		testContents: `test('${className} saves records', () => {
	const repository = new ${className}();
	const record = { id: 1 };
	expect(repository.save(record)).toBe(record);
	expect(repository.find(record.id)).toBe(record);
});

test('${className} finds no records before saving', () => {
	const repository = new ${className}();
	expect(repository.find(1)).toBeUndefined();
});`
	});
}

export function adapterFiles(name: string): PlannedFile[] {
	const className = `${toPascalCase(name)}Adapter`;
	const fileName = toKebabCase(name);
	const contents = `export interface ${className}Config {\n\tname?: string;\n}\n\nexport class ${className} {\n\tconstructor(private readonly config: ${className}Config = {}) {}\n\n\tconnect(): string {\n\t\treturn this.config.name ?? '${fileName}';\n\t}\n}\n`;

	return entityFiles({
		folder: 'adapters',
		fileName,
		className,
		contents,
		testContents: `test('${className} connects', () => {
	expect(new ${className}().connect()).toBe('${fileName}');
});

test('${className} connects with a configured name', () => {
	expect(new ${className}({ name: 'custom' }).connect()).toBe('custom');
});`
	});
}

export function validatorFiles(name: string): PlannedFile[] {
	const className = `${toPascalCase(name)}Validator`;
	const fileName = toKebabCase(name);
	const contents = `export interface ${className}Result {\n\tvalid: boolean;\n\terrors: string[];\n}\n\nexport class ${className} {\n\tvalidate(input: Record<string, unknown>): ${className}Result {\n\t\tconst errors = Object.keys(input).length === 0 ? ['input is empty'] : [];\n\t\treturn { valid: errors.length === 0, errors };\n\t}\n}\n`;

	return entityFiles({
		folder: 'validators',
		fileName,
		className,
		contents,
		testContents: `test('${className} validates input', () => {
	expect(new ${className}().validate({ title: 'value' })).toEqual({
		valid: true,
		errors: []
	});
});

test('${className} rejects empty input', () => {
	expect(new ${className}().validate({})).toEqual({
		valid: false,
		errors: ['input is empty']
	});
});`
	});
}

export function serializerFiles(name: string): PlannedFile[] {
	const className = `${toPascalCase(name)}Serializer`;
	const fileName = toKebabCase(name);
	const contents = `export class ${className} {\n\tserialize(input: Record<string, unknown>): Record<string, unknown> {\n\t\treturn { ...input };\n\t}\n}\n`;

	return entityFiles({
		folder: 'serializers',
		fileName,
		className,
		contents,
		testContents: `test('${className} serializes input', () => {
	const input = { title: 'value' };
	const result = new ${className}().serialize(input);
	expect(result).toEqual(input);
	expect(result).not.toBe(input);
});`
	});
}

export function policyFiles(name: string): PlannedFile[] {
	const className = `${toPascalCase(name)}Policy`;
	const fileName = toKebabCase(name);
	const contents = `export interface ${className}Actor {\n\trole?: string;\n}\n\nexport class ${className} {\n\tcanRead(actor: ${className}Actor): boolean {\n\t\treturn actor.role === 'admin';\n\t}\n}\n`;

	return entityFiles({
		folder: 'policies',
		fileName,
		className,
		contents,
		testContents: `test('${className} checks access', () => {
	expect(new ${className}().canRead({ role: 'admin' })).toBe(true);
});

test('${className} denies non-admin access', () => {
	expect(new ${className}().canRead({ role: 'member' })).toBe(false);
});`
	});
}

export function seederFiles(name: string): PlannedFile[] {
	const functionName = `seed${toPascalCase(name)}`;
	const fileName = toKebabCase(name);

	return [
		{
			path: `db/seed-data/${fileName}.ts`,
			contents: `export async function ${functionName}(): Promise<{ seeded: string }> {\n\treturn { seeded: '${fileName}' };\n}\n`
		},
		{
			path: `test/seeders/${fileName}.test.ts`,
			contents: `import { expect, test } from 'vitest';\nimport { ${functionName} } from '../../db/seed-data/${fileName}';\n\ntest('${functionName} returns seed metadata', async () => {\n\texpect(await ${functionName}()).toEqual({ seeded: '${fileName}' });\n});\n`
		}
	];
}

export function utilFiles(name: string): PlannedFile[] {
	const functionName = toCamelCase(name);
	const fileName = toKebabCase(name);

	return [
		{
			path: `src/utils/${functionName}.ts`,
			contents: `export function ${functionName}(value: string): string {\n\treturn value.trim();\n}\n`
		},
		{
			path: `test/utils/${fileName}.test.ts`,
			contents: `import { expect, test } from 'vitest';\nimport { ${functionName} } from '../../src/utils/${functionName}';\n\ntest('${functionName} trims values', () => {\n\texpect(${functionName}(' value ')).toBe('value');\n});\n`
		}
	];
}

function entityFiles(input: EntityFileInput): PlannedFile[] {
	return [
		{ path: `src/${input.folder}/${input.className}.ts`, contents: input.contents },
		{
			path: `test/${input.folder}/${input.fileName}.test.ts`,
			contents: `import { expect, test } from 'vitest';\nimport { ${input.className} } from '../../src/${input.folder}/${input.className}';\n\n${input.testContents}\n`
		}
	];
}

function repositoryContents(className: string): string {
	return `export interface RepositoryRecord {\n\tid: number;\n}\n\nexport class ${className}<T extends RepositoryRecord> {\n\tprivate readonly records = new Map<number, T>();\n\n\tfind(id: number): T | undefined {\n\t\treturn this.records.get(id);\n\t}\n\n\tsave(record: T): T {\n\t\tthis.records.set(record.id, record);\n\t\treturn record;\n\t}\n}\n`;
}
