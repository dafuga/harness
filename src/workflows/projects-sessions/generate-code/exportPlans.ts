import { toCamelCase, toKebabCase, toPascalCase } from '../../../helpers/strings/case';
import type { ExportPlan } from '../../../core/projects-sessions/exports';
import type { AdapterName } from '../../../templates/development-tooling/model';
import type { PieceKind } from '../../../templates/development-tooling/scaffoldTypes';

export function modelExportPlans(name: string): ExportPlan[] {
	const className = toPascalCase(name);

	return [
		{ source: `./models/${className}`, named: [className] },
		{
			source: `./models/${className}.types`,
			types: [`${className}Attributes`, `${className}CreateInput`, `${className}UpdateInput`]
		}
	];
}

export function adapterExportPlan(adapter: AdapterName): ExportPlan {
	const adapterName = adapter === 'd1' ? 'D1' : toPascalCase(adapter);
	return { source: `./models/adapters/${adapter}`, named: [`create${adapterName}Adapter`] };
}

export function pieceExportPlans(kind: PieceKind, name: string): ExportPlan[] {
	const className = classExportName(kind, name);

	if (className) {
		return [{ source: classExportSource(kind, className), named: [className] }];
	}

	if (kind === 'util' || kind === 'helper') {
		const functionName = toCamelCase(name);
		const folder = kind === 'helper' ? 'helpers' : 'utils';
		return [{ source: `./${folder}/${functionName}`, named: [functionName] }];
	}

	if (kind === 'seeder') {
		return [
			{ source: `../db/seed-data/${toKebabCase(name)}`, named: [`seed${toPascalCase(name)}`] }
		];
	}

	if (kind === 'concern') {
		return [
			{ source: `./concerns/with${toPascalCase(name)}`, named: [`with${toPascalCase(name)}`] }
		];
	}

	if (kind === 'initializer') {
		return [
			{
				source: `./initializers/initialize${toPascalCase(name)}`,
				named: [`initialize${toPascalCase(name)}`]
			}
		];
	}

	if (kind === 'config') {
		const configName = `${toCamelCase(name)}Config`;
		return [{ source: `./configs/${configName}`, named: [configName] }];
	}

	return [];
}

function classExportName(kind: PieceKind, name: string): string | undefined {
	const suffixes: Partial<Record<PieceKind, string>> = {
		controller: 'Controller',
		service: 'Service',
		decorator: 'Decorator',
		adapter: 'Adapter',
		repository: 'Repository',
		validator: 'Validator',
		serializer: 'Serializer',
		policy: 'Policy',
		job: 'Job',
		notification: 'Notification',
		command: 'Command',
		mailer: 'Mailer',
		channel: 'Channel',
		form: 'Form',
		middleware: 'Middleware'
	};
	const suffix = suffixes[kind];
	return suffix ? `${toPascalCase(name)}${suffix}` : undefined;
}

function classExportSource(kind: PieceKind, className: string): string {
	const folders: Partial<Record<PieceKind, string>> = {
		controller: 'controllers',
		service: 'services',
		decorator: 'decorators',
		adapter: 'adapters',
		repository: 'repositories',
		validator: 'validators',
		serializer: 'serializers',
		policy: 'policies',
		job: 'jobs',
		notification: 'notifications',
		command: 'commands',
		mailer: 'mailers',
		channel: 'channels',
		form: 'forms',
		middleware: 'middleware'
	};

	return `./${folders[kind]}/${className}`;
}
