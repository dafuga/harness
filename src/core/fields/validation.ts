import { validateName } from '../validation';

export function validateFieldName(name: string): string {
	return validateName(name, 'Field name');
}
