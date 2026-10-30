import { validateName } from './validateName';

export function validateFieldName(name: string): string {
	return validateName(name, 'Field name');
}
