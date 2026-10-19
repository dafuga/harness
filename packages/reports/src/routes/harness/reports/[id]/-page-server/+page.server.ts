import { redirect } from '@sveltejs/kit';
import type { HarnessIndex } from '../../../../../models/Harness.types';
import { consoleData } from '../../../../../utils/console-server/consoleServer';
import { repository } from '../../../../../utils/reportHttp';
import { reportDestination } from './reportDestination';

/**
 * The console has no report page. An earlier link to one opens the explorer where the report
 * belongs: Pages at the commit it names when this history holds it, else Pages at the branch tip.
 * The report itself, its files and its exports stay where the command line and the API read them.
 */
export async function load({ params }: { params: { id: string } }) {
	const [stored, report] = await Promise.all([
		consoleData.json('index.json'),
		repository.get(params.id).catch(() => null)
	]);
	const index = stored ? (JSON.parse(stored) as HarnessIndex) : null;
	redirect(307, '/harness' + reportDestination(index, report ?? { id: params.id }));
}
