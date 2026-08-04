#!/usr/bin/env bash
# Gitee Pages 一键部署（国内直连、手机可开）
# 用法: GITEE_REPO=owner/content-hub GITEE_TOKEN=xxxx bash scripts/deploy_gitee.sh
set -e
REPO="${GITEE_REPO}"        # 例如 zhao-yq728/content-hub
TOKEN="${GITEE_TOKEN}"
REMOTE="https://oauth2:${TOKEN}@gitee.com/${REPO}.git"
ROOT="/c/Users/admin02/WorkBuddy/2026-07-20-16-59-32/content-hub"
cd "$ROOT"

echo "=== 0) 校验 dist 产物 ==="
ls -la frontend/dist/index.html >/dev/null 2>&1 || { echo "dist 不存在，先 npm run build"; exit 1; }

echo "=== 1) 推送源码到 Gitee master ==="
git remote remove gitee 2>/dev/null || true
git remote add gitee "$REMOTE"
git push gitee master --force 2>&1 | tail -6

echo "=== 2) 构建 pages 分支(仅站点) ==="
GP="/c/Users/admin02/.gitee_pages_$(date +%s%N)"
git worktree add -B pages "$GP" HEAD
git -C "$GP" rm -r -q --ignore-unmatch . 2>/dev/null || true
cp -r frontend/dist/. "$GP"/
git -C "$GP" add -A
git -C "$GP" commit -q -m "deploy: Gitee Pages $(date +%F %T)" 2>&1 | tail -3
git -C "$GP" push gitee pages --force 2>&1 | tail -6
git worktree remove "$GP" --force
git remote remove gitee
echo "GITEE_DEPLOY_DONE"
