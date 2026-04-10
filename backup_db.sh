#!/bin/bash
# ============================================================
# 绮管电商 - 数据库自动备份脚本
# 用途: 每日自动备份数据库
# 调度: crontab (每天凌晨3点执行)
# ============================================================

set -e

# 配置
BACKUP_DIR="/www/backups/qiguan/db"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7
LOG_FILE="/var/log/db_backup.log"

DB_HOST="10.0.0.16"
DB_PORT="3306"
DB_USER="QMZYXCX"
DB_PASS="LJN040821."
DB_NAME="qmzyxcx"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 记录日志
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始数据库备份..." >> "$LOG_FILE"

# 执行备份
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${DATE}.sql.gz"

if mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  "$DB_NAME" | gzip > "$BACKUP_FILE"; then

  # 获取文件大小
  FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ 备份成功: $BACKUP_FILE ($FILE_SIZE)" >> "$LOG_FILE"
  
  # 清理旧备份（保留最近7天）
  find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null
  
  OLD_COUNT=$(find "$BACKUP_DIR" -name "*.sql.gz" | wc -l)
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📁 当前保留 $OLD_COUNT 个备份文件" >> "$LOG_FILE"
  
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ 备份失败!" >> "$LOG_FILE"
  exit 1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 备份完成" >> "$LOG_FILE"
echo "---" >> "$LOG_FILE"
