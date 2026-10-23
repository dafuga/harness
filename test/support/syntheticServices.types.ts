import type { ServiceAuthority } from '../../src/utils/platformServices';

export interface SyntheticServices {
	home: string;
	/** The made-up developer tools, vouched for, with the vetted service inside. */
	authority: ServiceAuthority;
	service: string;
	/** The same program under the same name where nothing vouches for it. */
	lookAlike: string;
	/** A plain program of the command's own. */
	helper: string;
	/** An application like the vouched one whose service carries another identity. */
	other: ServiceAuthority;
	/** An application whose service path is only a link to the look-alike. */
	linked: ServiceAuthority;
}
