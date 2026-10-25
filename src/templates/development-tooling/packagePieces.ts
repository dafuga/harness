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
			contents: `import { expect, test } from 'vitest';\nimport { ${className} } from '../../src/controllers/${className}';\n\ntest('${className}.index from default initialization returns ok', async () => {\n\tconst response = await new ${className}().index();\n\t// => { ok: true }\n\texpect(await response.json()).toEqual({ ok: true });\n});\n`
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
			contents: `import { expect, test } from 'vitest';\nimport { ${className} } from '../../src/${folder}/${className}';\n\ntest('${className}.run from default initialization returns the file name', () => {\n\t// => '${fileName}'\n\texpect(new ${className}().run()).toBe('${fileName}');\n});\n`
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
		testContents: `test('${className}.find from empty initialization returns missing', () => {\n\tconst repository = new ${className}();\n\t// => undefined\n\texpect(repository.find(1)).toBeUndefined();\n});\n\ntest('${className}.find from populated initialization returns matching and missing records', () => {\n\tconst repository = new ${className}();\n\tconst record = { id: 1 };\n\trepository.save(record);\n\t// => { id: 1 }\n\texpect(repository.find(record.id)).toBe(record);\n\t// => undefined\n\texpect(repository.find(2)).toBeUndefined();\n});\n\ntest('${className}.save from empty initialization stores valid records and rejects invalid records', () => {\n\tconst repository = new ${className}();\n\tconst record = { id: 1 };\n\t// => { id: 1 }\n\texpect(repository.save(record)).toBe(record);\n\texpect(repository.find(record.id)).toBe(record);\n\t// throws TypeError\n\texpect(() => new ${className}().save(null as never)).toThrow(TypeError);\n});\n\ntest('${className}.save from populated initialization replaces valid records and rejects invalid records', () => {\n\tconst repository = new ${className}();\n\trepository.save({ id: 1, label: 'original' });\n\tconst replacement = { id: 1, label: 'replacement' };\n\t// => { id: 1, label: 'replacement' }\n\texpect(repository.save(replacement)).toBe(replacement);\n\texpect(repository.find(replacement.id)).toBe(replacement);\n\t// throws TypeError\n\texpect(() => repository.save(null as never)).toThrow(TypeError);\n\texpect(repository.find(replacement.id)).toBe(replacement);\n});`
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
		testContents: `test('${className}.connect from default initialization returns the file name', () => {\n\t// => '${fileName}'\n\texpect(new ${className}().connect()).toBe('${fileName}');\n});\n\ntest('${className}.connect from custom initialization returns the configured name', () => {\n\t// => 'custom'\n\texpect(new ${className}({ name: 'custom' }).connect()).toBe('custom');\n});\n\ntest('${className}.connect with invalid config throws TypeError', () => {\n\tconst adapter = new ${className}(null as never);\n\t// throws TypeError\n\texpect(() => adapter.connect()).toThrow(TypeError);\n});`
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
		testContents: `test('${className}.validate from default initialization covers supported and invalid inputs', () => {\n\tconst validator = new ${className}();\n\t// => { valid: true, errors: [] }\n\texpect(validator.validate({ title: 'value' })).toEqual({ valid: true, errors: [] });\n\t// => { valid: false, errors: ['input is empty'] }\n\texpect(validator.validate({})).toEqual({ valid: false, errors: ['input is empty'] });\n\t// throws TypeError\n\texpect(() => validator.validate(null as never)).toThrow(TypeError);\n});`
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
		testContents: `test('${className}.serialize from default initialization covers empty, populated and invalid inputs', () => {\n\tconst serializer = new ${className}();\n\tconst input = { title: 'value' };\n\tconst result = serializer.serialize(input);\n\t// => { title: 'value' }\n\texpect(result).toEqual({ title: 'value' });\n\texpect(result).not.toBe(input);\n\t// => {}\n\tfor (const value of [{}, null, undefined])\n\t\texpect(serializer.serialize(value as never)).toEqual({});\n});`
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
		testContents: `test('${className}.canRead from default initialization covers roles and invalid actors', () => {\n\tconst policy = new ${className}();\n\t// => true\n\texpect(policy.canRead({ role: 'admin' })).toBe(true);\n\t// => false\n\texpect(policy.canRead({ role: 'member' })).toBe(false);\n\texpect(policy.canRead({})).toBe(false);\n\t// throws TypeError\n\texpect(() => policy.canRead(null as never)).toThrow(TypeError);\n});`
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
			contents: `import { expect, test } from 'vitest';\nimport { ${functionName} } from '../../db/seed-data/${fileName}';\n\ntest('${functionName} returns seed metadata for default invocation', async () => {\n\t// => { seeded: '${fileName}' }\n\texpect(await ${functionName}()).toEqual({ seeded: '${fileName}' });\n});\n`
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
			contents: `import { expect, test } from 'vitest';\nimport { ${functionName} } from '../../src/utils/${functionName}';\n\ntest('${functionName} trims padded text input', () => {\n\t// => 'value'\n\texpect(${functionName}(' value ')).toBe('value');\n});\n\ntest('${functionName} with null input throws TypeError', () => {\n\t// throws TypeError\n\texpect(() => ${functionName}(null as never)).toThrow(TypeError);\n});\n\ntest('${functionName} with undefined input throws TypeError', () => {\n\t// throws TypeError\n\texpect(() => ${functionName}(undefined as never)).toThrow(TypeError);\n});\n`
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
