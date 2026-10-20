import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { e2eFixtures } from '../../../src/utils/e2e-fixtures/e2eFixtures';

/** The fixtures of this run: its report store, its console history and its site checkouts. */
export const fixtures = e2eFixtures();
/** The application the servers of this run are hosted for, and another one beside it. */
export const sites = {
	own: fixtures.site('alpha-project'),
	foreign: fixtures.site('beta-project')
};

/** The id a seed left in the report store of this run, under the name of the file that holds it. */
export async function seededId(name = 'fixture-id'): Promise<string> {
	return (await readFile(join(fixtures.reports, name), 'utf8')).trim();
}
