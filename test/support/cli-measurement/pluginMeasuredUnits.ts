/** These units participate in the complete plugin CLI workload, including shared startup. */
export function pluginMeasuredUnits(args: string[]): string[] {
	const units = [
		'command.module-system-module',
		'service.module-system-module-definition',
		'template.module-system-builtin-modules',
		'template.module-system-standard-code-modules',
		'template.module-system-testing-plugins'
	];
	if (args[1] === 'generate' && args[2] === 'playwright')
		units.push('template.module-system-browser-testing-files');
	if (args[1] === 'add' && args[2] === 'headless-audio')
		units.push('template.module-system-audio-testing-files');
	if (args[1] === 'test') units.push('service.module-system-testing-plugin');
	return units;
}
