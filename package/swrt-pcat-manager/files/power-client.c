/* SPDX-License-Identifier: AGPL-3.0-only */
/* SWRT RPC client for the official v1 NUL-terminated JSON socket protocol. */
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <glib.h>
#include <json-c/json.h>
#include <poll.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/file.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/un.h>
#include <unistd.h>

static char error_message[256];
static const char *root = "";
static gint64 operation_deadline;
static char *path(const char *name) { return g_strconcat(root, name, NULL); }
static void message(const char *text) { g_strlcpy(error_message, text, sizeof(error_message)); }
static struct json_object *field(struct json_object *obj, const char *key) {
    struct json_object *value = NULL;
    if (obj) json_object_object_get_ex(obj, key, &value);
    return value;
}
static bool integer(struct json_object *obj, const char *key, int low, int high, int *out) {
    struct json_object *v = field(obj, key);
    if (!v || !json_object_is_type(v, json_type_int)) return false;
    int64_t n = json_object_get_int64(v);
    if (n < low || n > high) return false;
    *out = (int)n;
    return true;
}
static void number(struct json_object *obj, const char *key, int n) {
    json_object_object_add(obj, key, json_object_new_int(n));
}
static void string(struct json_object *obj, const char *key, const char *text) {
    json_object_object_add(obj, key, json_object_new_string(text));
}
static struct json_object *parse(const char *text, size_t length) {
    if (!g_utf8_validate(text, length, NULL)) return NULL;
    struct json_tokener *tokener = json_tokener_new();
    struct json_object *value = json_tokener_parse_ex(tokener, text, (int)length);
    size_t consumed = json_tokener_get_parse_end(tokener);
    while (consumed < length && g_ascii_isspace(text[consumed])) consumed++;
    bool valid = json_tokener_get_error(tokener) == json_tokener_success && consumed == length;
    json_tokener_free(tokener);
    if (!valid || !value || !json_object_is_type(value, json_type_object)) {
        if (value) json_object_put(value);
        return NULL;
    }
    return value;
}
static bool wait_socket(int fd, short event, gint64 deadline) {
    struct pollfd item = { .fd = fd, .events = event };
    for (;;) {
        int left = (int)((deadline - g_get_monotonic_time()) / 1000);
        if (left <= 0) return false;
        int n = poll(&item, 1, left);
        if (n < 0 && errno == EINTR) continue;
        return n > 0 && (item.revents & event);
    }
}
static struct json_object *command(const char *name, struct json_object *params) {
    struct json_object *request = params ? json_object_get(params) : json_object_new_object();
    string(request, "command", name);
    const char *wire = json_object_to_json_string_ext(request, JSON_C_TO_STRING_PLAIN);
    size_t length = strlen(wire) + 1, sent = 0, used = 0;
    struct json_object *reply = NULL;
    int fd = socket(AF_UNIX, SOCK_STREAM | SOCK_CLOEXEC | SOCK_NONBLOCK, 0);
    if (fd < 0) { json_object_put(request); return NULL; }
    char *socket_path = path("/tmp/pcat-manager.sock");
    struct sockaddr_un address = { .sun_family = AF_UNIX };
    g_strlcpy(address.sun_path, socket_path, sizeof(address.sun_path));
    g_free(socket_path);
    gint64 deadline = MIN(operation_deadline, g_get_monotonic_time() + 2000000);
    if (connect(fd, (struct sockaddr *)&address, sizeof(address)) < 0) {
        int socket_error = 0;
        socklen_t n = sizeof(socket_error);
        if (errno != EINPROGRESS || !wait_socket(fd, POLLOUT, deadline) ||
            getsockopt(fd, SOL_SOCKET, SO_ERROR, &socket_error, &n) || socket_error) goto done;
    }
    while (sent < length) {
        if (!wait_socket(fd, POLLOUT, deadline)) goto done;
        ssize_t n = send(fd, wire + sent, length - sent, MSG_NOSIGNAL);
        if (n < 0 && (errno == EAGAIN || errno == EINTR)) continue;
        if (n <= 0) goto done;
        sent += (size_t)n;
    }
    char buffer[32768];
    while (used < sizeof(buffer)) {
        if (!wait_socket(fd, POLLIN, deadline)) goto done;
        ssize_t n = recv(fd, buffer + used, sizeof(buffer) - used, 0);
        if (n < 0 && (errno == EAGAIN || errno == EINTR)) continue;
        if (n <= 0) goto done;
        char *end = memchr(buffer + used, '\0', (size_t)n);
        used += (size_t)n;
        if (!end) continue;
        reply = parse(buffer, (size_t)(end - buffer));
        int code;
        struct json_object *echo = field(reply, "command");
        if (!integer(reply, "code", 0, 0, &code) || !echo ||
            !json_object_is_type(echo, json_type_string) || strcmp(json_object_get_string(echo), name)) {
            if (reply) json_object_put(reply);
            reply = NULL;
        }
        break;
    }
done:
    close(fd);
    json_object_put(request);
    return reply;
}
struct snapshot {
    struct json_object *car, *schedule, *battery;
    int enabled, seconds;
    char *revision;
};
static struct json_object *battery(void) {
    struct json_object *reply = command("pmu-status", NULL);
    int mv, ac, percent, source, temperature;
    if (!integer(reply, "battery-voltage", 2500, 5000, &mv) ||
        !integer(reply, "charger-voltage", 0, 24000, &ac) ||
        !integer(reply, "charge-percentage", 0, 10000, &percent) ||
        !integer(reply, "on-battery", 0, 1, &source) ||
        !integer(reply, "board-temperature", -40, 125, &temperature)) {
        if (reply) json_object_put(reply);
        message("电源状态无效或已过期，暂时禁止修改策略");
        return NULL;
    }
    struct json_object *out = json_object_new_object();
    number(out, "percentage", (percent + 50) / 100);
    number(out, "battery_mv", mv);
    number(out, "supply_mv", ac);
    number(out, "temperature", temperature);
    json_object_object_add(out, "charging", json_object_new_boolean(!source));
    json_object_put(reply);
    return out;
}
static void clear_snapshot(struct snapshot *s) {
    if (s->car) json_object_put(s->car);
    if (s->schedule) json_object_put(s->schedule);
    if (s->battery) json_object_put(s->battery);
    g_free(s->revision);
    memset(s, 0, sizeof(*s));
}
static bool snapshot(struct snapshot *s) {
    s->battery = battery();
    if (!s->battery) return false;
    s->car = command("charger-on-auto-start-get", NULL);
    s->schedule = command("schedule-power-event-get", NULL);
    struct json_object *events = field(s->schedule, "event-list");
    if (!integer(s->car, "state", 0, 1, &s->enabled) ||
        !integer(s->car, "timeout", 0, 36000, &s->seconds) || !events ||
        !json_object_is_type(events, json_type_array) || json_object_array_length(events) > 12) {
        message("无法完整读取电源策略，请检查管理服务");
        return false;
    }
    struct json_object *canonical = json_object_new_object();
    number(canonical, "state", s->enabled);
    number(canonical, "timeout", s->seconds);
    json_object_object_add(canonical, "events", json_object_get(events));
    s->revision = g_compute_checksum_for_string(G_CHECKSUM_SHA256,
        json_object_to_json_string_ext(canonical, JSON_C_TO_STRING_PLAIN), -1);
    json_object_put(canonical);
    return true;
}
static bool valid_time(struct json_object *input, const char *key, int *minutes) {
    struct json_object *value = field(input, key);
    if (!value || !json_object_is_type(value, json_type_string)) return false;
    const char *text = json_object_get_string(value);
    if (strlen(text) != 5 || text[2] != ':' || !g_ascii_isdigit(text[0]) ||
        !g_ascii_isdigit(text[1]) || !g_ascii_isdigit(text[3]) || !g_ascii_isdigit(text[4])) return false;
    int hour = (text[0] - '0') * 10 + text[1] - '0';
    int minute = (text[3] - '0') * 10 + text[4] - '0';
    if (hour > 23 || minute > 59) return false;
    *minutes = hour * 60 + minute;
    return true;
}
static struct json_object *event(int time, int action) {
    struct json_object *entry = json_object_new_object();
    number(entry, "action", action);
    number(entry, "enabled", 1);
    number(entry, "enable-bits", 56);
    number(entry, "dow-bits", 127);
    number(entry, "hour", time / 60);
    number(entry, "minute", time % 60);
    return entry;
}
static bool set_car(int enabled, int seconds) {
    struct json_object *params = json_object_new_object();
    number(params, "state", enabled);
    number(params, "timeout", seconds);
    struct json_object *reply = command("charger-on-auto-start-set", params);
    json_object_put(params);
    if (!reply) return false;
    json_object_put(reply);
    return true;
}
static bool set_events(struct json_object *events) {
    struct json_object *params = json_object_new_object();
    json_object_object_add(params, "event-list", json_object_get(events));
    struct json_object *reply = command("schedule-power-event-set", params);
    json_object_put(params);
    if (!reply) return false;
    json_object_put(reply);
    return true;
}
static bool apply(struct json_object *input, struct snapshot *before) {
    int confirmed, minutes = 0, start = 0, stop = 0;
    struct json_object *mode = field(input, "mode"), *revision = field(input, "revision");
    if (!integer(input, "confirm", 1, 1, &confirmed) || !mode || !revision ||
        !json_object_is_type(mode, json_type_string) || !json_object_is_type(revision, json_type_string)) {
        message("请确认电源策略后再保存"); return false;
    }
    const char *name = json_object_get_string(mode);
    bool ups = !strcmp(name, "ups"), daily = !strcmp(name, "daily");
    if ((!ups && !daily && strcmp(name, "manual")) ||
        (ups && !integer(input, "minutes", 1, 600, &minutes)) ||
        (daily && (!valid_time(input, "start", &start) || !valid_time(input, "stop", &stop) || start == stop))) {
        message("模式或时间参数无效"); return false;
    }
    if (strcmp(json_object_get_string(revision), before->revision)) {
        message("电源策略已变化，请刷新后重新确认"); return false;
    }
    if (ups && !json_object_get_boolean(field(before->battery, "charging"))) {
        message("启用 UPS 模式前，请先接入外部电源"); return false;
    }
    struct json_object *events = json_object_new_array();
    if (daily) {
        json_object_array_add(events, event(start, 1));
        json_object_array_add(events, event(stop, 0));
    }
    bool applied = set_car(0, 0) && set_events(events) && (!ups || set_car(1, minutes * 60));
    struct snapshot after = {0};
    if (applied) {
        applied = snapshot(&after) && after.enabled == (ups ? 1 : 0) &&
                  (!ups || after.seconds == minutes * 60);
        struct json_object *observed = field(after.schedule, "event-list");
        if (applied) {
            size_t expected_count = daily ? 2 : 0;
            applied = json_object_array_length(observed) == expected_count;
            if (daily && applied) {
                for (int i = 0; i < 2 && applied; i++) {
                    struct json_object *row = json_object_array_get_idx(observed, i);
                    int action, hour, minute, enabled, bits, days;
                    int expected = i ? stop : start;
                    applied = integer(row, "action", 0, 1, &action) && action == (i ? 0 : 1) &&
                        integer(row, "hour", 0, 23, &hour) && hour == expected / 60 &&
                        integer(row, "minute", 0, 59, &minute) && minute == expected % 60 &&
                        integer(row, "enabled", 1, 1, &enabled) &&
                        integer(row, "enable-bits", 56, 56, &bits) && integer(row, "dow-bits", 127, 127, &days);
                }
            }
        }
    }
    clear_snapshot(&after);
    json_object_put(events);
    if (applied) return true;
    bool disabled = set_car(0, 0);
    bool restored_events = set_events(field(before->schedule, "event-list"));
    bool restored_car = restored_events && set_car(before->enabled, before->seconds);
    struct snapshot restored = {0};
    bool restored_ok = disabled && restored_events && restored_car && snapshot(&restored) &&
                       !strcmp(before->revision, restored.revision);
    clear_snapshot(&restored);
    message(restored_ok ? "保存失败，原有配置已恢复，请重新确认运行状态" : "保存未完成且未能确认恢复，请立即检查当前策略");
    return false;
}
int main(int argc, char **argv) {
    operation_deadline = g_get_monotonic_time() + 18000000;
#ifdef SWRT_POWER_TEST
    const char *test_root = getenv("SWRT_POWER_ROOT");
    if (test_root) root = test_root;
#endif
    struct json_object *out = NULL;
    char *board_file = path("/tmp/sysinfo/board_name"), *board = NULL;
    bool supported = g_file_get_contents(board_file, &board, NULL, NULL) &&
                     !strcmp(g_strstrip(board), "ariaboard,photonicat");
    g_free(board_file); g_free(board);
    if (!supported) { message("仅支持光影猫一代"); goto finish; }
    if (argc != 2 || (strcmp(argv[1], "status") && strcmp(argv[1], "battery") && strcmp(argv[1], "configure"))) {
        message("不支持的操作"); goto finish;
    }
    char *lock_path = path("/var/run/swrt-power.lock");
    int lock = open(lock_path, O_CREAT | O_RDWR | O_CLOEXEC | O_NOFOLLOW, 0600);
    g_free(lock_path);
    if (lock < 0 || flock(lock, LOCK_EX | LOCK_NB)) { message("电源管理正在处理另一项请求，请稍后重试"); goto finish; }
    if (!strcmp(argv[1], "battery")) out = battery();
    else {
        struct json_object *input = NULL;
        if (!strcmp(argv[1], "configure")) {
            char buffer[4097]; size_t n = fread(buffer, 1, sizeof(buffer), stdin);
            if (n == sizeof(buffer) || !(input = parse(buffer, n))) { message("请求参数无效"); goto finish; }
        }
        struct snapshot current = {0};
        bool valid = snapshot(&current);
        if (valid && input) valid = apply(input, &current);
        if (valid) {
            if (input) { clear_snapshot(&current); valid = snapshot(&current); }
            if (valid) {
                out = json_object_new_object();
                json_object_object_add(out, "battery", json_object_get(current.battery));
                json_object_object_add(out, "car", json_object_get(current.car));
                json_object_object_add(out, "events", json_object_get(field(current.schedule, "event-list")));
                string(out, "revision", current.revision);
            }
        }
        if (input) json_object_put(input);
        clear_snapshot(&current);
    }
finish:
    if (!out) {
        out = json_object_new_object();
        json_object_object_add(out, "ok", json_object_new_boolean(false));
        string(out, "message", error_message[0] ? error_message : "无法连接电源管理服务");
    } else json_object_object_add(out, "ok", json_object_new_boolean(true));
    puts(json_object_to_json_string_ext(out, JSON_C_TO_STRING_PLAIN));
    json_object_put(out);
    return 0;
}
