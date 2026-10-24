#!/usr/bin/env python3
"""Build a power-only profile of the pinned official v1 source."""
from pathlib import Path
import re
import sys


def replace(text, old, new):
    if text.count(old) != 1:
        raise ValueError("Official v1 source changed; review power profile")
    return text.replace(old, new, 1)


def profile(root):
    root = Path(root)
    main = (root / "src/main.c").read_text()
    main = replace(main, '''    if(!pcat_modem_manager_init())
    {
        g_warning("Failed to initialize modem manager, "
            "LTE/5G modem may not work!");
    }
''', '')
    main = replace(main, "    pcat_modem_manager_uninit();\n", "")
    (root / "src/main.c").write_text(main)

    controller = (root / "src/controller.c").read_text()
    # Remove whole official handlers, including their symbol references. The
    # remaining command table exposes power commands exclusively.
    blocked = ("modem_status_get", "network_route_mode_get", "modem_rfkill_mode_set",
               "modem_network_setup", "modem_network_get")
    for name in blocked:
        function = "pcat_controller_command_" + name + "_func"
        pattern = rf"\nstatic void {function}\([^\n]*(?:\n[^\n]*)*?\n\}}\n"
        controller, count = re.subn(pattern, "\n", controller, count=1)
        if count != 1:
            raise ValueError("Missing official command: " + name)
        entry = rf'    \{{\s*\.command = "[^"]+",\s*\.callback = {function},?\s*\}},\n'
        controller, count = re.subn(entry, "", controller, count=1)
        if count != 1:
            raise ValueError("Missing command registration: " + name)
    if "pcat_modem_manager_" in controller:
        raise ValueError("Unexpected modem dependency in power controller")
    controller = replace(controller, "    g_socket_service_start(ctrl_data->control_socket_service);",
                         "    g_chmod(PCAT_CONTROLLER_SOCKET_FILE, 0600);\n"
                         "    g_socket_service_start(ctrl_data->control_socket_service);")
    controller = replace(controller, '    child = json_object_new_int(countdown);',
                         '    json_object_object_add(rroot, "armed", json_object_new_boolean(swrt_pmu_ups_armed()));\n'
                         '    child = json_object_new_int(countdown);')
    controller = replace(controller, '    json_object_object_add(rroot, "event-list", array);',
                         '    json_object_object_add(rroot, "event-list", array);\n'
                         '    json_object_object_add(rroot, "timezone", json_object_new_string('\
                         'g_getenv("TZ") != NULL ? g_getenv("TZ") : "UTC"));')
    (root / "src/controller.c").write_text(controller)

    pmu = (root / "src/pmu-manager.c").read_text()
    if pmu.count("pcat_modem_manager_device_power_usage_get()") != 2:
        raise ValueError("Unexpected official PMU dependencies")
    pmu = pmu.replace("pcat_modem_manager_device_power_usage_get()", "swrt_modem_power_usage_get()")
    pmu = replace(pmu, "    guint last_battery_voltage;",
                  "    gint64 swrt_report_at;\n    gboolean swrt_ac_observed;\n"
                  "    guint last_battery_voltage;")
    pmu = replace(pmu, "    charger_voltage = data[2] + ((guint16)data[3] << 8);",
                  '''    charger_voltage = data[2] + ((guint16)data[3] << 8);
    if(battery_voltage < 2500 || battery_voltage > 5000 || charger_voltage > 24000)
    {
        pmu_data->swrt_report_at = 0;
        return;
    }''')
    # A reopened port must receive a new report before it can arm UPS shutdown.
    pmu = replace(pmu, '''static void pcat_pmu_serial_close(PCatPMUManagerData *pmu_data)
{''', '''static void pcat_pmu_serial_close(PCatPMUManagerData *pmu_data)
{
    pmu_data->swrt_report_at = 0;
    pmu_data->swrt_ac_observed = FALSE;''')
    pmu = replace(pmu, "    pmu_data->last_charger_voltage = charger_voltage;",
                  "    pmu_data->swrt_report_at = g_get_monotonic_time();\n"
                  "    pmu_data->last_charger_voltage = charger_voltage;")
    pmu = replace(pmu, "    on_battery = (charger_voltage < charge_detection_threshold);",
                  '''    on_battery = (charger_voltage < charge_detection_threshold);
    if(pmu_data->swrt_report_at == 0 || pmu_data->last_on_battery_state != on_battery)
        g_message("SWRT power source=%s, battery=%u mV, input=%u mV",
            on_battery ? "battery" : "external", battery_voltage, charger_voltage);''')
    pmu = replace(pmu, '''                    case PCAT_PMU_MANAGER_COMMAND_PMU_REQUEST_SHUTDOWN:
                    {
                        pcat_main_request_shutdown(FALSE);''',
                  '''                    case PCAT_PMU_MANAGER_COMMAND_PMU_REQUEST_SHUTDOWN:
                    {
                        g_message("SWRT MCU shutdown reason=%d, battery=%u mV, input=%u mV",
                            extra_data_len > 0 ? (gint)extra_data[0] : -1,
                            pmu_data->last_battery_voltage, pmu_data->last_charger_voltage);
                        pcat_main_request_shutdown(FALSE);''')
    # A manually booted router must observe external power before UPS shutdown
    # is armed. All heartbeat/watchdog/serial framing remains upstream code.
    pmu = replace(pmu, '''    if(pmu_data->last_charger_voltage >= charge_detection_threshold)''',
                  '''    if(pmu_data->swrt_report_at != 0 &&
       now - pmu_data->swrt_report_at < 15000000 &&
       pmu_data->last_charger_voltage >= charge_detection_threshold)''')
    pmu = replace(pmu, '''            if((pmu_data->power_on_event==3 || pmu_data->power_on_event==4) &&
               now > pmu_data->charger_on_auto_start_last_timestamp +''',
                  '''            if(pmu_data->swrt_report_at != 0 &&
               now - pmu_data->swrt_report_at < 15000000 &&
               pmu_data->last_charger_voltage >= charge_detection_threshold)
                pmu_data->swrt_ac_observed = TRUE;
            if(pmu_data->swrt_ac_observed &&
               pmu_data->swrt_report_at != 0 &&
               now - pmu_data->swrt_report_at < 15000000 &&
               now > pmu_data->charger_on_auto_start_last_timestamp +''')
    pmu = replace(pmu, '''    pcat_pmu_manager_charger_on_auto_start_internal(&g_pcat_pmu_manager_data,
        state);''', '''    g_pcat_pmu_manager_data.swrt_ac_observed = FALSE;
    g_pcat_pmu_manager_data.charger_on_auto_start_last_timestamp = g_get_monotonic_time();
    pcat_pmu_manager_charger_on_auto_start_internal(&g_pcat_pmu_manager_data,
        state);''')
    signature = "gboolean pcat_pmu_manager_pmu_status_get("
    start = pmu.index(signature)
    end = pmu.index("\nvoid pcat_pmu_manager_schedule_time_update()", start)
    prefix, getter, suffix = pmu[:start], pmu[start:end], pmu[end:]
    getter = replace(getter, "    if(!g_pcat_pmu_manager_data.initialized)",
                     "    if(!g_pcat_pmu_manager_data.initialized ||\n"
                     "       g_pcat_pmu_manager_data.serial_channel == NULL ||\n"
                     "       g_pcat_pmu_manager_data.swrt_report_at == 0 ||\n"
                     "       g_get_monotonic_time() - g_pcat_pmu_manager_data.swrt_report_at >= 15000000)")
    (root / "src/pmu-manager.c").write_text(prefix + getter + suffix +
        "\ngboolean swrt_pmu_ups_armed(void) { return g_pcat_pmu_manager_data.swrt_ac_observed; }\n")
    header = (root / "src/pmu-manager.h").read_text()
    header = replace(header, "G_END_DECLS", "gboolean swrt_pmu_ups_armed(void);\n"
                     "guint swrt_modem_power_usage_get(void);\n\nG_END_DECLS")
    (root / "src/pmu-manager.h").write_text(header)
    config = (root / "conf/pcat-manager.conf.sample").read_text()
    config = re.sub(r"^GPIO.*\n", "", config, flags=re.M)
    (root / "conf/pcat-manager.conf.sample").write_text(config)
    (root / "meson.build").write_text("""project('swrt-pcat-manager', 'c')
power_dependencies = [dependency('glib-2.0'), dependency('gio-2.0'),
    dependency('gio-unix-2.0'), dependency('gthread-2.0'),
    dependency('json-c'), dependency('threads')]
subdir('src')
""")
    (root / "src/swrt-modem-power-profile.c").write_bytes(
        Path(__file__).with_name("modem-power-profile.c").read_bytes())
    (root / "src/meson.build").write_text("""executable('pcat-manager', ['main.c', 'pmu-manager.c', 'controller.c', 'swrt-modem-power-profile.c'],
    dependencies: power_dependencies, install: true)
executable('swrt-power-client', 'swrt-power-client.c',
    dependencies: power_dependencies, install: true)
""")


if __name__ == "__main__":
    profile(sys.argv[1])
