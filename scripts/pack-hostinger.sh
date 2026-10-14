#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Running checks..."
npm run lint
npm run test:backend
npm run build

OUT="$ROOT/punyakart-hostinger.zip"
rm -f "$OUT"

echo "Creating $OUT..."
echo "Excluding secrets, development files, node_modules, and generated archives..."

zip -r "$OUT" . \
  -x "node_modules/*" \
  -x ".git/*" \
  -x ".venv*/*" \
  -x ".venv*/**/*" \
  -x ".env" \
  -x ".env.local" \
  -x ".env.production" \
  -x ".env.development" \
  -x "hostinger-env.txt" \
  -x "*.zip" \
  -x ".DS_Store" \
  -x "*/.DS_Store" \
  -x "coverage/*" \
  -x "dist/*.map"

echo
echo "Ready: $OUT"
echo
echo "Deployment package created for the MongoDB-backed Punyakart application."
echo "Upload this zip to Hostinger and extract it over the application."
echo
echo "IMPORTANT:"
echo "- Do NOT upload any .env file from this package."
echo "- Configure the production environment variables on Hostinger."
echo "- DATABASE_URL must point to MongoDB Atlas."
echo "- PUNYAKART_DB_NAME must be set to the production MongoDB database."
echo "- Application data is stored in MongoDB Atlas."