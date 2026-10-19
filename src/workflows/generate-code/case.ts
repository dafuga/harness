import { words } from '../../core/case';


export function toSnakeCase(value: string): string {
	return words(value).join('_');
}
