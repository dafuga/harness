import { toCamelCase, toKebabCase } from '../../helpers/strings/case';
import { fail } from './errors';
import { validateName } from './fields/validateName';
export { validateName } from './fields/validateName';

export function validateCodeName(name: string): string {
	return validateName(name, 'Code name');
}

export function validateRouteName(name: string): string {
	const route = toKebabCase(validateCodeName(name));

	if (!route) {
		fail('Route name must include letters or numbers.');
	}

	return route;
}

export function validateExportName(name: string): string {
	const exportName = toCamelCase(validateCodeName(name));

	if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(exportName)) {
		fail(`Generated export name "${exportName}" is not a valid TypeScript identifier.`);
	}

	return exportName;
}

export { validateFieldName } from './fields/validation';
