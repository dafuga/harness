export interface ReportSite {
	/** The checkout this server is hosted for. */
	root: string;
	/** What the application is called: the directory of its primary checkout. */
	name: string;
	/** Null when the server is not hosted in a Git repository; then only its own directory is. */
	identity: string | null;
}
