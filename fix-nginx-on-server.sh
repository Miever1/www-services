#!/bin/bash
# Nginx 修复脚本 - 解决 HTTP 413 错误
# 使用方法：在服务器上运行：bash fix-nginx-on-server.sh

set -e

echo "🔧 开始修复 Nginx 配置以支持大文件上传..."
echo "=========================================="

CONFIG_FILE="/etc/nginx/sites-available/default"

# 检查文件是否存在
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ 错误: 配置文件不存在: $CONFIG_FILE"
    exit 1
fi

# 备份配置
BACKUP="$CONFIG_FILE.backup.$(date +%Y%m%d-%H%M%S)"
sudo cp "$CONFIG_FILE" "$BACKUP"
echo "✅ 已备份配置文件到: $BACKUP"

# 检查并添加 server 块的 client_max_body_size
if ! grep -q "client_max_body_size.*50M" "$CONFIG_FILE"; then
    # 尝试多种匹配模式
    if sudo sed -i '/^[[:space:]]*server[[:space:]]*{/a\    client_max_body_size 50M;' "$CONFIG_FILE" 2>/dev/null; then
        echo "✅ 在 server 块添加了 client_max_body_size 50M"
    elif sudo sed -i '/server[[:space:]]*{/a\    client_max_body_size 50M;' "$CONFIG_FILE" 2>/dev/null; then
        echo "✅ 在 server 块添加了 client_max_body_size 50M"
    else
        echo "⚠️  无法自动添加 server 块配置，可能需要手动编辑"
    fi
else
    echo "✅ server 块已有 client_max_body_size 50M"
fi

# 检查并添加 location /api 块的 client_max_body_size
if grep -q "location[[:space:]]*/api" "$CONFIG_FILE"; then
    if ! grep -A 10 "location[[:space:]]*/api" "$CONFIG_FILE" | grep -q "client_max_body_size.*50M"; then
        if sudo sed -i '/location[[:space:]]*\/api[[:space:]]*{/a\        client_max_body_size 50M;' "$CONFIG_FILE" 2>/dev/null; then
            echo "✅ 在 location /api 块添加了 client_max_body_size 50M"
        else
            echo "⚠️  无法自动添加 location /api 块配置"
        fi
    else
        echo "✅ location /api 块已有 client_max_body_size 50M"
    fi
else
    echo "⚠️  未找到 location /api 块"
fi

# 测试配置
echo ""
echo "🧪 测试 Nginx 配置..."
if sudo nginx -t 2>&1; then
    echo ""
    echo "✅ 配置测试通过"
    echo "🔄 重新加载 Nginx..."
    if sudo systemctl reload nginx; then
        echo ""
        echo "=========================================="
        echo "✅ 修复完成！"
        echo "=========================================="
        echo ""
        echo "验证配置（应该看到两处 50M）:"
        sudo nginx -T 2>/dev/null | grep "client_max_body_size" || echo "（未找到）"
        echo ""
        echo "现在可以测试上传照片了！"
        echo "备份位置: $BACKUP"
    else
        echo "❌ 无法重载 Nginx"
        exit 1
    fi
else
    echo ""
    echo "❌ 配置测试失败，正在恢复备份..."
    sudo cp "$BACKUP" "$CONFIG_FILE"
    echo "✅ 已恢复备份"
    exit 1
fi

