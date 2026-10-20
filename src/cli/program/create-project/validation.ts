import { validateName } from '../../../core/validation';

export function validateProjectName(name: string): string {
	return validateName(name, 'Project name');
}

export {
	validateCodeName,
	validateRouteName,
	validateExportName,
	validateName,
	validateFieldName
} from '../../../core/validation';
export { validateKebabName } from '../../../workflows/loop-state/validation';
