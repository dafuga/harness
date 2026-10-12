import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The iOS shell of the one Harness renderer. It always loads the bundled static build: there is
 * no server address here, so a phone never falls back to a development or local host. The relay
 * origin is not configuration of the shell either; a person gives it when pairing.
 */
const config: CapacitorConfig = {
	appId: 'com.dafuga.harness',
	appName: 'Harness',
	webDir: 'build',
	ios: {
		contentInset: 'never',
		backgroundColor: '#031a28',
		allowsLinkPreview: false
	}
};

export default config;
