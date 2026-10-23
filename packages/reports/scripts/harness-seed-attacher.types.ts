/** What `harness history attach` is told: a commit, `HEAD` when omitted, and maybe a record. */
export interface SeedAttach {
	commit?: string;
	record?: string;
}
