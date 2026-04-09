#!/bin/bash
# ============================================================
# 数据库维护工具包
# 提供备份、清理、监控等功能
# ============================================================

DB_HOST="10.0.0.16"
DB_PORT="3306"
DB_USER="QMZYXCX"
DB_PASS="LJN040821."
DB_NAME="qmzyxcx"
BACKUP_DIR="./backups/mysql"

# 创建备份目录
mkdir -p ${BACKUP_DIR}

case "$1" in
  backup)
    # 全量备份
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    mysqldump -h${DB_HOST} -P${DB_PORT} -u${DB_USER} -p${DB_PASS} \
      --single-transaction --routines --triggers \
      ${DB_NAME} | gzip > ${BACKUP_DIR}/backup_${TIMESTAMP}.sql.gz
    echo "✅ 备份完成: ${BACKUP_DIR}/backup_${TIMESTAMP}.sql.gz"
    ;;

  cleanup)
    # 执行清理脚本
    mysql -h${DB_HOST} -P${DB_PORT} -u${DB_USER} -p${DB_PASS} ${DB_NAME} < database/cleanup_test_data.sql
    ;;

  status)
    # 显示数据库状态
    mysql -h${DB_HOST} -P${DB_PORT} -u${DB_USER} -p${DB_PASS} ${DB_NAME} -e "
      SELECT
        TABLE_NAME AS '表名',
        TABLE_ROWS AS '行数',
        ROUND(DATA_LENGTH/1024/1024, 2) AS '大小(MB)',
        CREATE_TIME AS '创建时间',
        UPDATE_TIME AS '更新时间'
      FROM information_schema.tables
      WHERE table_schema='${DB_NAME}'
      ORDER BY DATA_LENGTH DESC;
    "
    ;;

  test)
    # 测试连接
    mysql -h${DB_HOST} -P${DB_PORT} -u${DB_USER} -p${DB_PASS} ${DB_NAME} -e "SELECT 1 AS connection_ok;"
    ;;

  *)
    echo "用法: $0 {backup|cleanup|status|test}"
    echo ""
    echo "  backup   - 创建数据库全量备份"
    echo "  cleanup  - 清理测试数据"
    echo "  status   - 查看表状态统计"
    echo "  test     - 测试数据库连接"
    ;;
esac
