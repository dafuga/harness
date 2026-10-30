import { fail } from '../errors';

const safeNamePattern = /^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/;

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
