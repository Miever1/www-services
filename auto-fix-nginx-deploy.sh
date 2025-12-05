#!/bin/bash
# 自动修复 Nginx 配置脚本
# 可以通过 GitHub Actions 部署时运行

set -e

echo "🔧 自动修复 Nginx 配置..."
echo "================================"

# 查找 Nginx 配置文件
CONFIG_FILE="/etc/nginx/sites-available/default"

if [ ! -f "$CONFIG_FILE" ]; then
    # 尝试查找其他配置文件
    CONFIG_FILE=$(find /etc/nginx -name "*.conf" -type f -exec grep -l "location /api\|baicloud" {} \; 2>/dev/null | head -1)
fi

if [ -z "$CONFIG_FILE" ] || [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ 未找到 Nginx 配置文件"
    exit 1
fi

echo "✅ 找到配置文件: $CONFIG_FILE"

# 备份
BACKUP="$CONFIG_FILE.backup.$(date +%Y%m%d-%H%M%S)"
sudo cp "$CONFIG_FILE" "$BACKUP"
echo "✅ 已备份到: $BACKUP"

# 检查并修复 server 块
if ! grep -q "client_max_body_size.*50M" "$CONFIG_FILE"; then
    if grep -q "^[[:space:]]*server[[:space:]]*{" "$CONFIG_FILE"; then
        # 在 server { 后添加
        sudo sed -i '/^[[:space:]]*server[[:space:]]*{/a\    client_max_body_size 50M;' "$CONFIG_FILE"
        echo "✅ 添加了 server 块的 client_max_body_size 50M"
    else
        # 在第一个 server { 后添加
        sudo sed -i '/server[[:space:]]*{/a\    client_max_body_size 50M;' "$CONFIG_FILE"
        echo "✅ 添加了 server 块的 client_max_body_size 50M"
    fi
else
    echo "✅ server 块已有 client_max_body_size 50M"
fi

# 检查并修复 location /api 块
if grep -q "location[[:space:]]*/api" "$CONFIG_FILE"; then
    if ! grep -A 10 "location[[:space:]]*/api" "$CONFIG_FILE" | grep -q "client_max_body_size.*50M"; then
        # 在 location /api { 后添加
        sudo sed -i '/location[[:space:]]*\/api[[:space:]]*{/a\        client_max_body_size 50M;' "$CONFIG_FILE"
        echo "✅ 添加了 location /api 块的 client_max_body_size 50M"
    else
        echo "✅ location /api 块已有 client_max_body_size 50M"
    fi
else
    echo "⚠️  未找到 location /api 块"
fi

# 测试配置
echo ""
echo "🧪 测试 Nginx 配置..."
if sudo nginx -t; then
    echo "✅ 配置测试通过"
    echo "🔄 重新加载 Nginx..."
    sudo systemctl reload nginx
    echo ""
    echo "================================"
    echo "✅ 修复完成！"
    echo "================================"
else
    echo "❌ 配置测试失败，正在恢复备份..."
    sudo cp "$BACKUP" "$CONFIG_FILE"
    exit 1
fi

