// @harness-uid u_udwbgdiocs
/** Only our packaged renderer can call privileged project operations. */
export class NavigationValidator {
	validate(value: string | undefined): boolean {
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

	allowsTrackerTextLink(source: string, href: string, frame: string): boolean {
		if (frame !== '_blank' && frame !== '') return false;
		if (!this.validate(source) || !/^\/(?:projects|tracker)\/?$/.test(new URL(source).pathname))
			return false;
		try {
			const url = new URL(href);
			const web = url.protocol === 'http:' || url.protocol === 'https:';
			return web && Boolean(url.hostname) && !url.username && !url.password;
		} catch {
			return false;
		}
	}
}
