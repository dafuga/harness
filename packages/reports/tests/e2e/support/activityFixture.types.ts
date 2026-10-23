/**
 * Gives the fixture application a history to show: two components, three loops of two types,
 * a change with its reason noted, work in its second checkout that is not committed, and agents
 * that registered through the public command: one working, one quiet, one finished, and one of
 * another application. It is made once for a run, with the commands a project itself uses.
 */
export interface ActivityFixture {
	commits: { first: string; second: string };
}
