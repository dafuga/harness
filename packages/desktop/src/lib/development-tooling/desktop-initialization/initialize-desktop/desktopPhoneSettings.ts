// @harness-uid u_3en7p2purk
import { loadVaultPhone } from '../../../../services/networking-security/remote-host-service/vaultPhone';

export function desktopPhoneSettings() {
	const device = process.env.HARNESS_TRACKER_PHONE_WRITE_DEVICE?.trim();
	const token = process.env.HARNESS_TRACKER_PHONE_WRITE_TOKEN;
	return {
		vaultPhone: loadVaultPhone(process.env.HARNESS_VAULT_PHONE_CONFIG),
		trackerPhone: process.env.HARNESS_TRACKER_PHONE_DEVICE?.trim(),
		trackerWrite: device && token ? { device, token } : undefined
	};
}
