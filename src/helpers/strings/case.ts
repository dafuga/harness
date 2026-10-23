/** @pure */
export function toKebabCase(textToConvert: string): string {
	return words(textToConvert).join('-');
}

/** @pure */
export function toPascalCase(textToConvert: string): string {
	return words(textToConvert)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join('');
}

/** @pure */
export function toCamelCase(textToConvert: string): string {
	const pascal = toPascalCase(textToConvert);
	return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/** @pure */
export function toSnakeCase(textToConvert: string): string {
	return words(textToConvert).join('_');
}

/** @pure */
function words(textToConvert: string): string[] {
	return textToConvert
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.split(/[^a-zA-Z0-9]+/)
		.filter(Boolean)
		.map((word) => word.toLowerCase());
}
