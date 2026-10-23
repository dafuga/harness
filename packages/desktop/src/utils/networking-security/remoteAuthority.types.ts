/** Under whose identity and which grant what is on a page was read. */
export interface Authority {
	holder: string | null;
	grant: string;
}
