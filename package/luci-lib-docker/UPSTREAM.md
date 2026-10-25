# Lua Docker compatibility library

The two Lua modules are based on ImmortalWrt LuCI commit
`eb6146ac77323e99450240fd8abb5bdb87970609`, immediately before removal of the
Lua implementation. It is retained alongside the JavaScript manager because
iStore applications such as ITTools still require `luci.docker`, while
Home Assistant / CodeServer console pages require `luci.model.docker`.

- Source: https://github.com/immortalwrt/luci/blob/eb6146ac77323e99450240fd8abb5bdb87970609/collections/luci-lib-docker/luasrc/docker.lua
- Original SHA256: `d6dd5087436fa259f5bf8965faf9d158af6c57294cfe1458523e1d7c5a667058`
- Model source: https://github.com/immortalwrt/luci/blob/eb6146ac77323e99450240fd8abb5bdb87970609/applications/luci-app-dockerman/luasrc/model/docker.lua
- Model SHA256: `bf0baf0207955f7656b3a15ad06139e610603d7fb3d803dab5eded217994b020`
- License: AGPL-3.0, original copyright retained.

The API module additionally assembles complete JSON/NDJSON responses, reports
transport failures consistently, closes failed sockets, writes complete
requests and decodes complete log frames independently of HTTP chunk borders.
The original API module is retained as a test fixture. The model module is
unchanged. This package installs libraries, with no second Docker daemon,
controller, menu or competing runtime.
