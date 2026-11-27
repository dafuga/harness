// @harness-uid u_s5yfdrdvhw
/** The recovery device's private scalars and public points, sealed under the recovery secret. */
export interface RecoveryMaterial {
	deviceId: string;
	kemD: string;
	signingD: string;
	kemPublic: string;
	signingPublic: string;
}
