#!/usr/bin/env bash
set -euo pipefail
exec celery -A setup worker --loglevel=info --concurrency=2
