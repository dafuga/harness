import { closeE2eRun } from '../../../src/utils/e2eFixtures';

/** Ends a run: the directory it made is removed, and nothing of any other run. */
export default function removeFixtures(): void {
	closeE2eRun();
}
