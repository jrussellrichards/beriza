#!/bin/sh
set -e

echo "Running database migrations..."
npm run migrate

echo "Seeding initial data..."
npm run seed

echo "Starting Berisa API..."
npm run start
