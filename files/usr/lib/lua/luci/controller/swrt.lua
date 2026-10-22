local http = require "luci.http"
local sys = require "luci.sys"

module("luci.controller.swrt", package.seeall)

function index()
    -- Inherit LuCI's authenticated admin dispatcher; accept no probe URL input.
    entry({"admin", "swrt", "apk-status"}, call("apk_status")).leaf = true
end

function apk_status()
    local status = sys.exec("/usr/libexec/swrt-apk-status"):match("^(%w+)")
    http.prepare_content("application/json")
    http.header("Cache-Control", "no-store")
    http.write_json({ok = status == "ok", available = status ~= "unavailable"})
end
