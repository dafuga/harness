// @harness-uid u_ftz5ij2vz4
import {
	uiDesignAntiPatterns,
	uiDesignPatternRules
} from '../../templates/development-tooling/uiDesignGuidance';
import type { Guide } from './guide.types';

export const uiDesignGuide: Guide = {
	topic: 'ui-design',
	summary:
		'Design clean screens: one main piece, actions as buttons, forms in dialogs, quiet status.',
	steps: [
		'Name the one main piece of the screen and the job of every other element on it.',
		'Put primary actions in one row of buttons above the main piece; give only one the primary style.',
		'Move each create, edit, connect or settings form into a dialog or its own page, opened by a button.',
		'Reduce status to one quiet line or chip; put its details and settings in a dialog.',
		'Mark overview screens with <!-- @harness-view overview --> and run harness audit.',
		'Capture desktop, tablet and phone screenshots of the screen and each dialog, and inspect them.'
	],
	rules: uiDesignPatternRules,
	antiPatterns: uiDesignAntiPatterns,
	exampleCommands: ['harness info ui-design', 'harness audit .']
};
