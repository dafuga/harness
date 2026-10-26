import type { CaseExample, ClassEntityTemplate, FunctionTemplate } from './railsPieces.types';
import { toCamelCase, toKebabCase, toPascalCase } from '../../helpers/strings/case';
import type { PlannedFile } from '../../core/development-tooling/files';
import { apiFiles, viewFiles } from './appPieces';
import { adapterTypeFiles } from './adapterTypes';
import { controllerFiles, policyFiles, serializerFiles } from './packagePieces';
import { modelFiles } from './model';
import {
	valueCase,
	errorCase,
	channelCases,
	formCases,
	middlewareCases
} from './rails-pieces/railsCases';
import { parseFields } from '../../core/development-tooling/fields/fields';

export function mailerFiles(name: string): PlannedFile[] {
	const className = `${toPascalCase(name)}Mailer`;
	const fileName = toKebabCase(name);
	const contents = `export interface ${className}Message {\n\tsubject: string;\n\ttext: string;\n}\n\nexport class ${className} {\n\trender(recipient: string): ${className}Message {\n\t\tif (recipient.trim() === '') throw new RangeError('recipient is required');\n\t\treturn { subject: '${toPascalCase(name)}', text: \`Hello \${recipient}\` };\n\t}\n}\n`;

	return classEntityFiles({
		folder: 'mailers',
		fileName,
		className,
		contents,
		cases: [
			{
				...valueCase(
					'render addresses a greeting to the recipient',
					"render('Ada')",
					`{ subject: '${toPascalCase(name)}', text: 'Hello Ada' }`
				),
				checks: [errorCase('render rejects a blank recipient', "render('  ')", 'RangeError')]
			}
		]
	});
}

export function helperFiles(name: string): PlannedFile[] {
	const functionName = toCamelCase(name);
	return functionFiles({
		folder: 'helpers',
		name: toKebabCase(name),
		functionName,
		body: `/** @pure */\nexport function ${functionName}(textToFormat: string): string {\n\tif (typeof textToFormat !== 'string') throw new TypeError('${functionName} expects text');\n\treturn textToFormat.trim();\n}\n`,
		examples: [
			valueCase('trims surrounding whitespace', `${functionName}('  label  ')`, "'label'"),
			valueCase('returns blank for whitespace-only input', `${functionName}('   ')`, "''"),
			errorCase(
				'rejects non-text input',
				`${functionName}(42 as never)`,
				`'${functionName} expects text'`
			)
		]
	});
}

export function concernFiles(name: string): PlannedFile[] {
	const functionName = `with${toPascalCase(name)}`;
	const fileName = toKebabCase(name);
	return functionFiles({
		folder: 'concerns',
		name: fileName,
		functionName,
		body: `export function ${functionName}<T extends object>(input: T): T & { concern: string } {\n\tif (typeof input !== 'object' || input === null) throw new TypeError('input must be an object');\n\treturn { ...input, concern: '${fileName}' };\n}\n`,
		examples: [
			valueCase(
				'adds the concern name to the input',
				`${functionName}({ value: true })`,
				`{ value: true, concern: '${fileName}' }`
			),
			errorCase('rejects a missing input', `${functionName}(null as never)`, 'TypeError')
		]
	});
}

export function channelFiles(name: string): PlannedFile[] {
	const className = `${toPascalCase(name)}Channel`;
	const fileName = toKebabCase(name);
	const contents = `export class ${className} {\n\tprivate subscribers = 0;\n\n\tsubscribe(): number {\n\t\tthis.subscribers += 1;\n\t\treturn this.subscribers;\n\t}\n\n\tbroadcast(payload: string): string {\n\t\tif (payload === '') throw new RangeError('payload is required');\n\t\treturn payload;\n\t}\n}\n`;

	return classEntityFiles({
		folder: 'channels',
		fileName,
		className,
		contents,
		cases: channelCases
	});
}

export function formFiles(name: string): PlannedFile[] {
	const className = `${toPascalCase(name)}Form`;
	const fileName = toKebabCase(name);
	const contents = `export class ${className} {\n\tconstructor(private readonly values: Record<string, unknown> = {}) {}\n\n\tvalidate(): string[] {\n\t\treturn Object.keys(this.values).length === 0 ? ['values are required'] : [];\n\t}\n\n\ttoPayload(): Record<string, unknown> {\n\t\treturn { ...this.values };\n\t}\n}\n`;

	return classEntityFiles({ folder: 'forms', fileName, className, contents, cases: formCases });
}

export function initializerFiles(name: string): PlannedFile[] {
	const functionName = `initialize${toPascalCase(name)}`;
	const configName = `${toPascalCase(name)}InitializerConfig`;
	return functionFiles({
		folder: 'initializers',
		name: toKebabCase(name),
		functionName,
		body: `export interface ${configName} {\n\tenabled?: boolean;\n}\n\nexport function ${functionName}(config: ${configName} = {}): boolean {\n\tconst enabled = config.enabled ?? true;\n\tif (typeof enabled !== 'boolean') throw new TypeError('enabled must be a boolean');\n\treturn enabled;\n}\n`,
		examples: [
			valueCase('enables by default when no config is given', `${functionName}()`, 'true'),
			valueCase('reports false when disabled', `${functionName}({ enabled: false })`, 'false'),
			errorCase('rejects non-boolean', `${functionName}({ enabled: 'no' as never })`, 'TypeError')
		]
	});
}

export function configFiles(name: string): PlannedFile[] {
	const configName = `${toCamelCase(name)}Config`;
	return [
		{
			path: `src/configs/${configName}.ts`,
			contents: `// Add only controls a person needs to change, then declare their audience and purpose\n// in the unit's configControls before making this configuration public.\nexport const ${configName} = {} as const;\n`
		}
	];
}

export function middlewareFiles(name: string): PlannedFile[] {
	const className = `${toPascalCase(name)}Middleware`;
	const fileName = toKebabCase(name);
	const contents = `export class ${className} {\n\thandle(request: Request): Request | Response {\n\t\tif (!request) throw new TypeError('request is required');\n\t\treturn request;\n\t}\n}\n`;

	return classEntityFiles({
		folder: 'middleware',
		fileName,
		className,
		contents,
		cases: middlewareCases
	});
}

export function resourceFiles(name: string): PlannedFile[] {
	return [
		...adapterTypeFiles(),
		...modelFiles({ name, fields: parseFields(['title:string']), adapter: 'sqlite' }),
		...controllerFiles(name),
		...policyFiles(name),
		...serializerFiles(name),
		...apiFiles(name),
		...viewFiles(name)
	];
}

function classEntityFiles(input: ClassEntityTemplate): PlannedFile[] {
	const instance = toCamelCase(input.className);
	const tests = input.cases.map((item) =>
		caseTest(item.title, [
			`const ${instance} = new ${input.className}(${item.init ?? ''});`,
			...(item.arrange ?? []),
			...(item.steps ?? []).map((step) => `${instance}.${step};`),
			...assertionLines(`${instance}.${item.call}`, item),
			...(item.checks ?? []).flatMap((check) => assertionLines(`${instance}.${check.call}`, check))
		])
	);
	return [
		{ path: `src/${input.folder}/${input.className}.ts`, contents: input.contents },
		testFile(input.folder, input.fileName, input.className, tests)
	];
}

function functionFiles(input: FunctionTemplate): PlannedFile[] {
	const tests = input.examples.map((item) => caseTest(item.title, assertionLines(item.call, item)));
	return [
		{ path: `src/${input.folder}/${input.functionName}.ts`, contents: input.body },
		testFile(input.folder, input.name, input.functionName, tests)
	];
}

function testFile(folder: string, fileName: string, name: string, tests: string[]): PlannedFile {
	return {
		path: `test/${folder}/${fileName}.test.ts`,
		contents: `import { describe, expect, test } from 'vitest';\nimport { ${name} } from '../../src/${folder}/${name}';\n\ndescribe('${name}', () => {\n${tests.join('\n')}});\n`
	};
}

function caseTest(title: string, lines: string[]): string {
	return `\ttest('${title}', () => {\n${lines.map((line) => `\t\t${line}\n`).join('')}\t});\n`;
}

function assertionLines(call: string, outcome: CaseExample): string[] {
	if ('throws' in outcome)
		return [`// throws ${outcome.throws}`, `expect(() => ${call}).toThrow(${outcome.throws});`];
	const matcher = outcome.identity ? 'toBe' : 'toEqual';
	return [`// => ${outcome.expected}`, `expect(${call}).${matcher}(${outcome.expected});`];
}
