/** @pure */
export function featureSpecStructure(textToFormat: string): string {
	if (typeof textToFormat !== 'string') throw new TypeError('featureSpecStructure expects text');
	return textToFormat.trim();
}

/** @pure */
export function featureSpecFindings(files: string[]) {
	const present = new Set(files);
	return files.flatMap((file) => {
		if (!file.startsWith('specification/features/')) return [];
		const image =
			/^specification\/features\/planned\/([a-z0-9]+(?:-[a-z0-9]+)*)\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:png|jpg|jpeg|webp)$/.exec(
				file
			);
		if (image && present.has(`specification/features/planned/${image[1]}.md`)) return [];
		if (
			/^specification\/features\/(?:(?:implemented|planned)\/)?[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(
				file
			)
		)
			return [];
		return [
			{
				path: file,
				rule: 'harness-spec-structure',
				message: 'Feature specs should live in specification/features/ with kebab-case names.'
			}
		];
	});
}
