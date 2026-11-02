// @harness-uid u_tm2cqtmoei
import { validateName } from './validateName';

export function validateFieldName(name: string): string {
	return validateName(name, 'Field name');
}
