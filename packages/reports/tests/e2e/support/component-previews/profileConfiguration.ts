import { PerformanceProfileService } from '../../../../../../src/services/PerformanceProfileService';

/** Include fixture resolution and synthetic input rendering in the build configuration workload. */
export async function profileConfiguration() {
	const previous = process.env.SHELL_FIXTURE_PAGE;
	try {
		process.env.SHELL_FIXTURE_PAGE = 'catalog';
		const { default: configure } = await import('../../../../src/config/shellViteConfig');
		if (typeof configure !== 'function')
			throw new Error('Expected the fixture configuration factory.');
		await new PerformanceProfileService().capture(
			{
				unit: 'reports.config.shell-vite',
				workload: 'catalog-fixture-configuration',
				rounds: 1,
				iterations: 1,
				warmups: 0
			},
			() => configure({ command: 'build', mode: 'production' })
		);
	} finally {
		if (previous === undefined) delete process.env.SHELL_FIXTURE_PAGE;
		else process.env.SHELL_FIXTURE_PAGE = previous;
	}
}
