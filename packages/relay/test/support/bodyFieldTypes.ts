/** Display the field types of an already asserted real validator result. */
export function bodyFieldTypes(body: object) {
	return Object.fromEntries(Object.entries(body).map(([name, value]) => [name, typeof value]));
}
