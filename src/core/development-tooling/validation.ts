import { toCamelCase, toKebabCase } from '../../helpers/development-tooling/case';
import { fail } from './errors';

const safeNamePattern = /^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/;

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

export function validateName(name: string, label: string): string {
	const value = name.trim();

	if (!value) {
		fail(`${label} cannot be empty.`);
	}

	if (value.includes('..') || value.includes('/') || value.includes('\\')) {
		fail(`${label} cannot include path traversal or path separators.`);
	}

	if (!safeNamePattern.test(value)) {
		fail(
			`${label} must start with a letter or number and use letters, numbers, spaces, dashes, or underscores.`
		);
	}

	return value;
}

export { validateFieldName } from './fields/validation';
