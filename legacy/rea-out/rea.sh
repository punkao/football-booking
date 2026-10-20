#!/usr/bin/env bash
# rea.sh — bash version of the lesson's rea/rea.ps1: run REA (image rea-lab:6.4.0) with the project root mounted as /work
#   legacy/rea-out/rea.sh [-o legacy/rea-out/x.json] [-n network] <rea args...>   (paths given to REA must start with /work/)
# stdout of REA goes to the -o file (written by the container: UTF-8 without BOM); rea_progress lines on stderr are dropped
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; command -v cygpath >/dev/null && ROOT="$(cygpath -m "$ROOT")"
OUT=""; NET=""
while [ $# -gt 0 ]; do case "$1" in -o) OUT="$2"; shift 2;; -n) NET="$2"; shift 2;; *) break;; esac; done
ARGS=(run --rm -v "$ROOT:/work" -w /work --add-host host.docker.internal:host-gateway)
[ -n "$NET" ] && ARGS+=(--network "$NET")
if [ -n "$OUT" ]; then
  ARGS+=(-e "REA_OUT=/work/$OUT" --entrypoint sh rea-lab:6.4.0 -c 'mkdir -p "$(dirname "$REA_OUT")"; { rea "$@" 2>&1 1>"$REA_OUT"; echo $? > /tmp/rc; } | grep --line-buffered -v rea_progress 1>&2; exit $(cat /tmp/rc)' rea)
else
  ARGS+=(--entrypoint sh rea-lab:6.4.0 -c '{ rea "$@" 2>&1 1>&3 3>&-; echo $? > /tmp/rc; } 3>&1 | grep --line-buffered -v rea_progress 1>&2; exit $(cat /tmp/rc)' rea)
fi
MSYS_NO_PATHCONV=1 docker "${ARGS[@]}" "$@"
