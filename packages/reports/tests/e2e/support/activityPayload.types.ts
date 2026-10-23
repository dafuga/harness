/**
 * A reading of project activity as a busy repository gives it, made up whole: twenty commits of
 * which the newest touched hundreds of components, forty committed files, two checkouts with
 * forty-four files not committed, and twelve agents of which the first has forty assignments.
 * A browser test serves it in place of the server's answer, so no fixture is changed for it.
 */
export interface PayloadAgent {
	label: string;
	state: string;
	detail?: string;
	units?: string[];
	heartbeatAt?: string;
	expiresAt?: string;
}
