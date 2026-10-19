export function toKebabCase(value: string): string {
	return words(value).join('-');
}

export function toPascalCase(value: string): string {
	return words(value)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join('');
}

export function toCamelCase(value: string): string {
	const pascal = toPascalCase(value);
	return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function toSnakeCase(value: string): string {
	return words(value).join('_');
}

function words(value: string): string[] {
	return value
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.split(/[^a-zA-Z0-9]+/)
		.filter(Boolean)
		.map((word) => word.toLowerCase());
}
