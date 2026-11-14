// @harness-uid u_c2uuoqwiz3
import { specificationStorageReport } from '../src/cli/program/manageUnitsStorage';
export { specificationStorageReport } from '../src/cli/program/manageUnitsStorage';

if (import.meta.main) {
	console.log(JSON.stringify(await specificationStorageReport(process.cwd()), null, 2));
}
