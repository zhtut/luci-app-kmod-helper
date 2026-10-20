#!/bin/sh
# Self-check for the rpcd backend validators: extract the validator section
# from luci.easy-setup (between its marker comments) and exercise edge cases.
# Run: sh luci-app-easy-setup/tests/validators.sh
set -u

SCRIPT="$(dirname "$0")/../root/usr/libexec/rpcd/luci.easy-setup"
TMP="${TMPDIR:-/tmp}/es-validators.$$.sh"
sed -n '/^# ---------- validators/,/^# ---------- helpers/p' "$SCRIPT" | sed '$d' >"$TMP"
# shellcheck disable=SC1090
. "$TMP"
rm -f "$TMP"

fail=0
count=0
expect_ok() {
	count=$((count + 1))
	out=$("$1" "$2")
	[ -z "$out" ] || { echo "FAIL (expected valid): $1 '$2' -> $out"; fail=1; }
}
expect_err() {
	count=$((count + 1))
	out=$("$1" "$2")
	[ -n "$out" ] || { echo "FAIL (expected invalid): $1 '$2'"; fail=1; }
}

expect_ok  err_private_ip 192.168.1.2
expect_ok  err_private_ip 10.0.0.2
expect_ok  err_private_ip 172.16.0.1
expect_ok  err_private_ip 172.31.255.254
expect_err err_private_ip 55.1.2.3
expect_err err_private_ip 8.8.8.8
expect_err err_private_ip 172.15.0.1
expect_err err_private_ip 172.32.0.1
expect_err err_private_ip 192.168.1.0
expect_err err_private_ip 192.168.1.255
expect_err err_private_ip 192.168.01.2
expect_err err_private_ip 256.1.1.1
expect_err err_private_ip 192.168.1
expect_err err_private_ip abc
expect_err err_private_ip ""

expect_ok  err_hostname OpenWrt-Lab
expect_ok  err_hostname a
expect_err err_hostname -bad
expect_err err_hostname bad-
expect_err err_hostname ""
expect_err err_hostname under_score

expect_ok  err_password 12345678
expect_err err_password 1234567
expect_err err_password ""

expect_ok  err_ssid MyWifi
expect_err err_ssid ""

expect_ok  err_wifi_key 12345678
expect_err err_wifi_key 1234567

if [ "$fail" -eq 0 ]; then
	echo "ALL $count SHELL VALIDATOR TESTS PASSED"
else
	echo "SHELL VALIDATOR TESTS FAILED"
fi
exit "$fail"
