import { validateName } from '../../../core/development-tooling/validation';

export function validateProjectName(name: string): string {
	return validateName(name, 'Project name');
}

export {
	validateCodeName,
	validateRouteName,
	validateExportName,
	validateName,
	validateFieldName
} from '../../../core/development-tooling/validation';
export { validateKebabName } from '../../../workflows/development-tooling/loop-state/validation';
