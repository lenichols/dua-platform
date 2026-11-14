#!/bin/sh
set -eu

# Run migrations before the app starts unless the deployment runs them as a
# separate job. With several replicas, set RUN_MIGRATIONS=false and run
# `docker run --rm <image> node scripts/migrate.mjs` once per release.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Running database migrations..."
  node scripts/migrate.mjs
fi

exec "$@"
