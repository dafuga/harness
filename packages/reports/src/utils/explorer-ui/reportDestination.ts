/** What an earlier report address is known to name: the report, and the revision it recorded. */
export interface NamedReport {
	id: string;
	revision?: string | null;
}

export { reportDestination } from '../../routes/harness/reports/[id]/reportDestination';
