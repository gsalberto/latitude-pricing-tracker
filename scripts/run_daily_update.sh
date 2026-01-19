#!/bin/bash

# Daily update script for Latitude Pricing Tracker
# Run this script via cron to update competitor data daily

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/daily_update_$(date +%Y%m%d).log"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

cd "$PROJECT_DIR"

echo "Starting daily update at $(date)" >> "$LOG_FILE"

# Run the update script
npx tsx scripts/daily_update.ts >> "$LOG_FILE" 2>&1

echo "Daily update completed at $(date)" >> "$LOG_FILE"

# Keep only last 30 days of logs
find "$LOG_DIR" -name "daily_update_*.log" -mtime +30 -delete 2>/dev/null || true
