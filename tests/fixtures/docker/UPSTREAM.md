# Pinned Docker feed fixtures

These are exact upstream files used to exercise the compatibility patches,
including authentication routes and real frontend log decoding.

- `menu.json`, `common.js`, `api.js`, `container.js`, `docker_rpc.uc`, `docker_controller.uc`:
  https://github.com/immortalwrt/luci/tree/61e876e98f91446fd8968dfede721b98ddf80a32/applications/luci-app-dockerman
- `dockerd.init`:
  https://github.com/immortalwrt/packages/blob/d200499b31751dc5c72905f37a747712f009f155/utils/dockerd/files/dockerd.init

Original copyright and license notices are retained. Expected file hashes are
in `scripts/docker-source-hashes.json`; feed drift stops the build.

`docker-legacy.lua` is the original Lua transport module from ImmortalWrt LuCI
commit `eb6146ac77323e99450240fd8abb5bdb87970609`, retained to document the
baseline before the SWRT response-assembly and error-handling fixes.
