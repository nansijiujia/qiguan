#!/bin/bash
HEALTH_URL="http://127.0.0.1:3003/api/v1/health/detailed"
ALERT_THRESHOLD=5
LOG_FILE="monitoring.log"

response=$(curl -s --max-time 5 "$HEALTH_URL")
status=$(echo $response | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

timestamp=$(date '+%Y-%m-%d %H:%M:%S')

if [ "$status" != "ok" ]; then
  echo "[$timestamp] ❌ Health check FAILED: status=$status | Response: $response" >> $LOG_FILE
else
  echo "[$timestamp] ✅ Health check OK" >> $LOG_FILE
fi
