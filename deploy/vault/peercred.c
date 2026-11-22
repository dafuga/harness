#define _GNU_SOURCE
#include <node_api.h>
#include <stdint.h>
#include <sys/socket.h>
#include <unistd.h>

static int unix_peer_uid(int fd, uid_t *uid) {
  struct sockaddr_storage address;
  socklen_t length = sizeof(address);
  if (getpeername(fd, (struct sockaddr *)&address, &length) != 0 ||
      address.ss_family != AF_UNIX) return -1;

#if defined(__APPLE__)
  gid_t gid;
  return getpeereid(fd, uid, &gid);
#elif defined(__linux__)
  struct ucred peer;
  length = sizeof(peer);
  if (getsockopt(fd, SOL_SOCKET, SO_PEERCRED, &peer, &length) != 0 ||
      length != sizeof(peer)) return -1;
  *uid = peer.uid;
  return 0;
#else
  return -1;
#endif
}

static napi_value peer_uid(napi_env env, napi_callback_info info) {
  napi_value argv[1];
  size_t argc = 1;
  int32_t fd;
  uid_t uid;
  napi_value result;
  if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != napi_ok || argc != 1 ||
      napi_get_value_int32(env, argv[0], &fd) != napi_ok || fd < 0 ||
      unix_peer_uid(fd, &uid) != 0 || uid == (uid_t)-1) {
    napi_get_null(env, &result);
    return result;
  }
  if (napi_create_uint32(env, uid, &result) != napi_ok) return NULL;
  return result;
}

NAPI_MODULE_INIT() {
  napi_value method;
  if (napi_create_function(env, "peerUid", NAPI_AUTO_LENGTH, peer_uid, NULL, &method) != napi_ok ||
      napi_set_named_property(env, exports, "peerUid", method) != napi_ok) return NULL;
  return exports;
}
