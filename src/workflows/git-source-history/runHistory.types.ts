export interface HistoryOptions {
	root?: string;
	/** Source commit; `HEAD` by default. */
	commit?: string;
	/** Record id or record file; the latest record of the commit when omitted. */
	record?: string;
}
