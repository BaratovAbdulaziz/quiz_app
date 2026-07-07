#!/usr/bin/env bash
set -euo pipefail

echo "Starting Docker services..."
docker start quiz-postgres 2>/dev/null || echo "quiz-postgres already running or not found"
docker start quiz-minio 2>/dev/null || echo "quiz-minio already running or not found"

echo "Waiting for PostgreSQL..."
until docker exec quiz-postgres pg_isready -U postgres -d quiz_app >/dev/null 2>&1; do
  sleep 1
done
echo "PostgreSQL ready."

echo "Waiting for MinIO..."
until curl -s http://localhost:9000/minio/health/live >/dev/null 2>&1; do
  sleep 1
done
echo "MinIO ready."
