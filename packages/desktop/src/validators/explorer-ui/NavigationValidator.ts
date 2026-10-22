/** Only our packaged renderer can call privileged project operations. */
export class NavigationValidator {
	validate(value: unknown): boolean {
		if (typeof value !== 'string') return false;
		try {
			const url = new URL(value);
			return (
				url.protocol === 'harness:' && url.hostname === 'app' && !url.username && !url.password
			);
		} catch {
			return false;
		}
	}
}
