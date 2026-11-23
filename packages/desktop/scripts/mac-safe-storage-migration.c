#include <Security/Security.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>

static const char legacy_service[] = "harness-desktop Safe Storage";
static const char legacy_account[] = "harness-desktop Key";

static bool valid_name(const char *name) {
    if (strcmp(name, "Harness") == 0) return true;
    return strlen(name) == 24 && strncmp(name, "Harness ", 8) == 0 &&
        strspn(name + 8, "0123456789abcdef") == 16;
}

/* The helper is signed with the app's designated requirement. The new item's
 * default ACL admits that requirement. Both existing items and all ciphertext
 * stay intact. No key bytes leave this process or Keychain Services. */
int main(int argc, char *argv[]) {
    const bool interactive = argc == 3 && strcmp(argv[2], "--interactive") == 0;
    if ((argc != 2 && !interactive) || !valid_name(argv[1])) return 1;
    if (SecKeychainSetUserInteractionAllowed(false) != errSecSuccess) return 1;
    char release_service[sizeof("Harness 0123456789abcdef Safe Storage")];
    char release_account[sizeof("Harness 0123456789abcdef Key")];
    const UInt32 service_length = (UInt32)snprintf(release_service, sizeof(release_service), "%s Safe Storage", argv[1]);
    const UInt32 account_length = (UInt32)snprintf(release_account, sizeof(release_account), "%s Key", argv[1]);

    SecKeychainItemRef existing = NULL;
    OSStatus result = SecKeychainFindGenericPassword(NULL,
        service_length, release_service, account_length, release_account, NULL, NULL, &existing);
    if (existing) CFRelease(existing);
    if (result == errSecSuccess) return 0;
    if (result != errSecItemNotFound) return 1;

    if (interactive && SecKeychainSetUserInteractionAllowed(true) != errSecSuccess) return 1;
    UInt32 length = 0;
    void *password = NULL;
    result = SecKeychainFindGenericPassword(NULL,
        sizeof(legacy_service) - 1, legacy_service,
        sizeof(legacy_account) - 1, legacy_account, &length, &password, NULL);
    const OSStatus interaction = SecKeychainSetUserInteractionAllowed(false);
    if (result == errSecSuccess && interaction == errSecSuccess && password && length > 0) {
        result = SecKeychainAddGenericPassword(NULL,
            service_length, release_service, account_length, release_account, length, password, NULL);
    } else {
        result = errSecInteractionNotAllowed;
    }
    if (password) {
        volatile unsigned char *bytes = password;
        for (UInt32 i = 0; i < length; i++) bytes[i] = 0;
        SecKeychainItemFreeContent(NULL, password);
    }
    return result == errSecSuccess ? 0 : 1;
}
