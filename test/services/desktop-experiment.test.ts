import { expect, test } from 'vitest';
import { DesktopExperimentService } from '../../src/services/DesktopExperimentService';

test('experimental patch refuses an unknown installed build before producing a patch', () => {
	expect(() =>
		new DesktopExperimentService().plan(new Map(), {
			dataPath: '/tmp/data',
			catalogPath: '/tmp/models.json'
		})
	).toThrow('Unsupported desktop build');
});
