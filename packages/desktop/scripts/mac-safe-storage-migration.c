#include <Security/Security.h>
#include <stdbool.h>
#include <string.h>

static const char legacy_service[] = "harness-desktop Safe Storage";
static const char legacy_account[] = "harness-desktop Key";
static const char release_service[] = "Harness Safe Storage";
static const char release_account[] = "Harness Key";

/* The helper is signed with the app's designated requirement. The new item's
 * default ACL admits that requirement. Both existing items and all ciphertext
 * stay intact. No key bytes leave this process or Keychain Services. */
int main(int argc, char *argv[]) {
    const bool interactive = argc == 2 && strcmp(argv[1], "--interactive") == 0;
    if (argc != 1 && !interactive) return 1;
    if (SecKeychainSetUserInteractionAllowed(false) != errSecSuccess) return 1;

    SecKeychainItemRef existing = NULL;
    OSStatus result = SecKeychainFindGenericPassword(NULL,
        sizeof(release_service) - 1, release_service,
        sizeof(release_account) - 1, release_account, NULL, NULL, &existing);
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
            sizeof(release_service) - 1, release_service,
            sizeof(release_account) - 1, release_account, length, password, NULL);
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
