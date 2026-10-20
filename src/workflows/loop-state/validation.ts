import { fail } from '../../core/errors';

export function validateKebabName(name: string, label: string): string {
	const value = name.trim();

	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
		fail(`${label} must use lowercase kebab-case.`);
	}

	return value;
}
