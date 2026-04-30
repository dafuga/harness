import { toCamelCase, toKebabCase, toPascalCase } from '../core/case';
import type { PlannedFile } from '../core/files';
import { apiFiles, e2eFiles, viewFiles } from './appPieces';
import { adapterTypeFiles } from './adapterTypes';
import { controllerFiles, policyFiles, serializerFiles } from './packagePieces';
import { modelFiles } from './model';
import { parseFields } from '../core/fields';

interface ClassEntityTemplate {
	folder: string;
	fileName: string;
	className: string;
	contents: string;
	expectation: string;
}

interface FunctionTemplate {
	folder: string;
	name: string;
	functionName: string;
	body: string;
	expectation: string;
	call: string;
	expected: string;
}

export function mailerFiles(name: string): PlannedFile[] {
	const className = `${toPascalCase(name)}Mailer`;
	const fileName = toKebabCase(name);
	const contents = `export interface ${className}Message {\n\tsubject: string;\n\ttext: string;\n}\n\nexport class ${className} {\n\trender(recipient: string): ${className}Message {\n\t\treturn { subject: '${toPascalCase(name)}', text: \`Hello \${recipient}\` };\n\t}\n}\n`;

	return classEntityFiles({ folder: 'mailers', fileName, className, contents, expectation: 'renders messages' });
}

export function helperFiles(name: string): PlannedFile[] {
	const className = `${toPascalCase(name)}Helper`;
	const fileName = toKebabCase(name);
	const contents = `export class ${className} {\n\tformat(value: string): string {\n\t\treturn value.trim();\n\t}\n}\n`;

	return classEntityFiles({ folder: 'helpers', fileName, className, contents, expectation: 'formats values' });
}

export function concernFiles(name: string): PlannedFile[] {
	const functionName = `with${toPascalCase(name)}`;
	const fileName = toKebabCase(name);

	return functionFiles({
		folder: 'concerns',
		name: fileName,
		functionName,
		body: `export function ${functionName}<T extends object>(input: T): T & { concern: string } {\n\treturn { ...input, concern: '${fileName}' };\n}\n`,
		expectation: 'adds concern metadata',
		call: `${functionName}({ value: true })`,
		expected: `{ value: true, concern: '${fileName}' }`
	});
}

export function channelFiles(name: string): PlannedFile[] {
	const className = `${toPascalCase(name)}Channel`;
	const fileName = toKebabCase(name);
	const contents = `export class ${className} {\n\tprivate subscribers = 0;\n\n\tsubscribe(): number {\n\t\tthis.subscribers += 1;\n\t\treturn this.subscribers;\n\t}\n\n\tbroadcast(payload: string): string {\n\t\treturn payload;\n\t}\n}\n`;

	return classEntityFiles({ folder: 'channels', fileName, className, contents, expectation: 'broadcasts payloads' });
}

export function formFiles(name: string): PlannedFile[] {
	const className = `${toPascalCase(name)}Form`;
	const fileName = toKebabCase(name);
	const contents = `export class ${className} {\n\tconstructor(private readonly values: Record<string, unknown> = {}) {}\n\n\tvalidate(): string[] {\n\t\treturn Object.keys(this.values).length === 0 ? ['values are required'] : [];\n\t}\n\n\ttoPayload(): Record<string, unknown> {\n\t\treturn { ...this.values };\n\t}\n}\n`;

	return classEntityFiles({ folder: 'forms', fileName, className, contents, expectation: 'validates payloads' });
}

export function initializerFiles(name: string): PlannedFile[] {
	const functionName = `initialize${toPascalCase(name)}`;
	const fileName = toKebabCase(name);

	return functionFiles({
		folder: 'initializers',
		name: fileName,
		functionName,
		body: `export interface ${toPascalCase(name)}InitializerConfig {\n\tenabled?: boolean;\n}\n\nexport function ${functionName}(config: ${toPascalCase(name)}InitializerConfig = {}): boolean {\n\treturn config.enabled ?? true;\n}\n`,
		expectation: 'returns enabled state',
		call: `${functionName}({ enabled: true })`,
		expected: 'true'
	});
}

export function configFiles(name: string): PlannedFile[] {
	const configName = `${toCamelCase(name)}Config`;
	const fileName = toKebabCase(name);

	return [
		{
			path: `src/config/${configName}.ts`,
			contents: `export const ${configName} = {\n\tname: '${fileName}',\n\tenabled: true\n} as const;\n`
		},
		{
			path: `test/config/${fileName}.test.ts`,
			contents: `import { expect, test } from 'vitest';\nimport { ${configName} } from '../../src/config/${configName}';\n\ntest('${configName} is enabled', () => {\n\texpect(${configName}.enabled).toBe(true);\n});\n`
		}
	];
}

export function middlewareFiles(name: string): PlannedFile[] {
	const className = `${toPascalCase(name)}Middleware`;
	const fileName = toKebabCase(name);
	const contents = `export class ${className} {\n\thandle(request: Request): Request | Response {\n\t\treturn request;\n\t}\n}\n`;

	return classEntityFiles({
		folder: 'middleware',
		fileName,
		className,
		contents,
		expectation: 'passes through requests'
	});
}

export function resourceFiles(name: string): PlannedFile[] {
	const fields = parseFields(['title:string']);

	return [
		...adapterTypeFiles(),
		...modelFiles({ name, fields, adapter: 'sqlite' }),
		...controllerFiles(name),
		...policyFiles(name),
		...serializerFiles(name),
		...apiFiles(name),
		...viewFiles(name),
		...e2eFiles(name)
	];
}

function classEntityFiles(input: ClassEntityTemplate): PlannedFile[] {
	return [
		{ path: `src/${input.folder}/${input.className}.ts`, contents: input.contents },
		{
			path: `test/${input.folder}/${input.fileName}.test.ts`,
			contents: `import { expect, test } from 'vitest';\nimport { ${input.className} } from '../../src/${input.folder}/${input.className}';\n\ntest('${input.className} ${input.expectation}', () => {\n\texpect(new ${input.className}()).toBeInstanceOf(${input.className});\n});\n`
		}
	];
}

function functionFiles(input: FunctionTemplate): PlannedFile[] {
	return [
		{ path: `src/${input.folder}/${input.functionName}.ts`, contents: input.body },
		{
			path: `test/${input.folder}/${input.name}.test.ts`,
			contents: `import { expect, test } from 'vitest';\nimport { ${input.functionName} } from '../../src/${input.folder}/${input.functionName}';\n\ntest('${input.functionName} ${input.expectation}', () => {\n\texpect(${input.call}).toEqual(${input.expected});\n});\n`
		}
	];
}
