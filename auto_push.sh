#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

LOG_FILE="deploy_$(date +%Y%m%d_%H%M%S).log"
BRANCH="绮管"
REMOTE="origin"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

log() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

log "=========================================="
log "开始自动部署流程"
log "目标分支: $BRANCH"
log "远程仓库: $REMOTE"
log "=========================================="

if ! git diff --quiet || ! git diff --cached --quiet; then
    log "检测到更改，准备提交..."
    
    git add -A
    
    CHANGED_FILES=$(git diff --cached --name-only)
    if [ -z "$CHANGED_FILES" ]; then
        log "没有需要提交的更改"
        exit 0
    fi
    
    COMMIT_MSG="自动提交: $(date '+%Y-%m-%d %H:%M:%S')"
    git commit -m "$COMMIT_MSG"
    log "提交成功: $COMMIT_MSG"
else
    log "没有检测到更改，跳过提交步骤"
fi

log "正在推送到 $REMOTE/$BRANCH ..."
git push "$REMOTE" "$BRANCH"

log "=========================================="
log "✅ 推送完成！"
log "日志文件: $LOG_FILE"
log "=========================================="
