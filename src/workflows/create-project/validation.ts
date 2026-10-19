import { validateName } from '../../core/validation';

export function validateProjectName(name: string): string {
	return validateName(name, 'Project name');
}
