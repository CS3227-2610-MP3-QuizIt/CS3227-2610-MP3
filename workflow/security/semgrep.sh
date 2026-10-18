#!/bin/sh
set -eu

if [ "$#" -gt 1 ]; then
    echo "Usage: sh workflow/security/semgrep.sh [local-output.json]" >&2
    exit 64
fi

scan_script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$scan_script_dir/../.."

if ! command -v semgrep >/dev/null 2>&1; then
    echo "Semgrep is unavailable; see workflow/security/semgrep.md for setup." >&2
    exit 127
fi

if [ "$#" -eq 1 ]; then
    case "$1" in
        *://*|-|'')
            echo "Output must be a local file path, not a URL or stdout marker." >&2
            exit 64
            ;;
    esac
    set -- "--output=$1"
fi

export SEMGREP_SEND_METRICS=off
export SEMGREP_ENABLE_VERSION_CHECK=0
semgrep --version >&2

# Advisory findings: preserve scanner failures, but do not use --error/--strict.
exec semgrep scan \
    --config p/python --config p/typescript \
    --oss-only --metrics off --disable-version-check --no-autofix \
    --json "$@" backend/src frontend/src
