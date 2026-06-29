#!/usr/bin/env bash
# sync-github.sh
# 从 bic-map 直接推送到 GitHub 公开仓库（github 远端），
# 推送前自动过滤掉内网专用文件，不影响本地分支。
#
# 内网专用文件（保留在 GitLab，不推送到 GitHub）：
#   .cursor/        — Cursor IDE 配置（含内部 AI 规则/技能）
#   .Dockerfile     — 内网构建镜像脚本
#   .gitlab-ci.yml  — GitLab CI/CD 流水线
#   Dockerfile      — 内网容器镜像
#   nginx.conf      — 内网 Nginx 配置
#   pnpm.sh         — 内网构建辅助脚本
#   sync-github.sh  — 本脚本（内部工作流）

set -euo pipefail

GITHUB_REMOTE="github"
GITHUB_BRANCH="main"

INTERNAL_FILES=(
  ".cursor"
  ".Dockerfile"
  ".gitlab-ci.yml"
  "Dockerfile"
  "nginx.conf"
  "pnpm.sh"
  "sync-github.sh"
)

# ── 工具函数 ──────────────────────────────────────────────────────────────────
info() { echo "  $*"; }
ok()   { echo "✅ $*"; }
warn() { echo "⚠️  $*"; }
die()  { echo "❌ $*" >&2; exit 1; }

# ── 前置检查 ──────────────────────────────────────────────────────────────────
[ -d ".git" ] || die "请在 bic-map 仓库根目录下执行此脚本。"

git remote get-url "$GITHUB_REMOTE" &>/dev/null \
  || die "未找到远端 '$GITHUB_REMOTE'，请先执行：
  git remote add $GITHUB_REMOTE git@github.com:Open-X-Humanoid/BICMap.git"

if ! git diff --quiet || ! git diff --cached --quiet; then
  die "工作区有未提交的变更，请先 commit 或 stash 后再执行同步。"
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
TEMP_BRANCH="sync-github-$(date +%s)"

echo "🚀 bic-map → GitHub (BICMap)"
echo "   远端：$(git remote get-url $GITHUB_REMOTE)"
echo "   分支：$CURRENT_BRANCH  →  $GITHUB_REMOTE/$GITHUB_BRANCH"
echo

# ── 检测哪些内部文件当前被 git 追踪 ──────────────────────────────────────────
TRACKED=()
for f in "${INTERNAL_FILES[@]}"; do
  # git ls-files 对目录要加 /
  if [ -n "$(git ls-files "$f" "$f/" 2>/dev/null)" ]; then
    TRACKED+=("$f")
  fi
done

# ── 创建临时分支，剔除内部文件，推送后销毁 ────────────────────────────────────
info "创建临时过滤分支：$TEMP_BRANCH"
git checkout -b "$TEMP_BRANCH" --quiet

cleanup() {
  git checkout "$CURRENT_BRANCH" --quiet 2>/dev/null || true
  git branch -D "$TEMP_BRANCH" 2>/dev/null || true
}
trap cleanup EXIT

if [ ${#TRACKED[@]} -gt 0 ]; then
  warn "以下内部文件已追踪，将从本次推送中剔除："
  for f in "${TRACKED[@]}"; do echo "    $f"; done
  echo

  git rm -r --cached --ignore-unmatch "${TRACKED[@]}" >/dev/null
  git commit -m "chore: exclude internal-only files for public release" \
    --author="sync-github <sync-github@bic-map>" \
    --quiet
else
  info "当前无内部文件被追踪，直接推送。"
fi

info "推送到 $GITHUB_REMOTE/$GITHUB_BRANCH ..."
git push "$GITHUB_REMOTE" "$TEMP_BRANCH:$GITHUB_BRANCH" --force-with-lease

# cleanup 由 trap 自动执行
echo
ok "同步完成！已推送到 GitHub BICMap。"
