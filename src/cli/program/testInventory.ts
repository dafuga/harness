import { loadUnits } from '../../workflows/development-tooling/load-units/loadUnits';
import { WorkingTreeAdapter } from '../../adapters/git-source-history/WorkingTreeAdapter';
import { TestDiscoveryService } from '../../services/verification-evidence/TestDiscoveryService';
import { TestContractService } from '../../services/verification-evidence/TestContractService';

/** Read-only migration inventory; unresolved computed cases are reported, never guessed. */
export async function inventoryTests(root = process.cwd()) {
	const loaded = await loadUnits(root);
	const paths = [...loaded.index.files.values()]
		.filter(
			(file) => file.classification === 'test' && /\.(test|spec)\.[cm]?[jt]sx?$/.test(file.path)
		)
		.map((file) => file.path);
	const discovered = await new TestDiscoveryService().discover(new WorkingTreeAdapter(root), paths);
	const contracts = loaded.stored.filter((unit) => unit.status === 'active' && unit.testing);
	const errors = new TestContractService().validate({
		units: loaded.stored,
		scenarios: loaded.scenarios,
		files: new Set(loaded.index.files.keys()),
		tests: discovered.tests,
		required: true
	});
	return {
		files: paths.length,
		declarations: discovered.tests.length,
		standardizedUnits: contracts.length,
		standardizedCases: contracts.reduce((sum, unit) => sum + unit.testing!.cases.length, 0),
		tests: discovered.tests,
		errors: [...discovered.errors, ...errors]
	};
}
