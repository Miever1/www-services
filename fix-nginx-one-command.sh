#!/bin/bash
# 一键修复 Nginx 配置 - 最简单版本
# 使用方法：复制整个脚本内容到服务器上运行：bash -c "$(cat fix-nginx-one-command.sh)"

set -e

echo "🔧 Nginx 配置一键修复工具"
echo "================================"
echo ""

# 检查权限
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  需要 root 权限"
    echo "请使用: sudo bash -c \"\$(curl -s https://raw.githubusercontent.com/Miever1/www-services/feature/test/fix-nginx-one-command.sh)\""
    exit 1
fi

# 查找配置文件
CONFIG_FILE=""
if [ -f "/etc/nginx/sites-available/default" ]; then
    CONFIG_FILE="/etc/nginx/sites-available/default"
elif [ -f "/etc/nginx/nginx.conf" ]; then
    CONFIG_FILE="/etc/nginx/nginx.conf"
else
    # 查找包含 baicloud 的配置
    CONFIG_FILE=$(find /etc/nginx -name "*.conf" -type f -exec grep -l "baicloud\|location /api" {} \; 2>/dev/null | head -1)
fi

if [ -z "$CONFIG_FILE" ]; then
    echo "❌ 未找到配置文件"
    echo "请手动指定配置文件路径"
    exit 1
fi

echo "✅ 找到配置文件: $CONFIG_FILE"

# 备份
BACKUP="$CONFIG_FILE.backup.$(date +%Y%m%d-%H%M%S)"
cp "$CONFIG_FILE" "$BACKUP"
echo "✅ 已备份到: $BACKUP"

# 检查并添加配置
HAS_SERVER_SIZE=$(grep -c "client_max_body_size" "$CONFIG_FILE" || true)
HAS_API_SIZE=$(grep -A 10 "location /api" "$CONFIG_FILE" | grep -c "client_max_body_size" || true)

# 在 server 块添加
if ! grep -q "client_max_body_size.*50M" "$CONFIG_FILE"; then
    if grep -q "client_max_body_size" "$CONFIG_FILE"; then
        # 替换现有的
        sed -i 's/client_max_body_size.*/client_max_body_size 50M;/g' "$CONFIG_FILE"
        echo "✅ 更新了 server 块的 client_max_body_size"
    else
        # 添加新的
        sed -i '/server {/a\    client_max_body_size 50M;' "$CONFIG_FILE"
        echo "✅ 添加了 server 块的 client_max_body_size"
    fi
fi

# 在 location /api 块添加
if grep -q "location /api" "$CONFIG_FILE"; then
    if ! grep -A 10 "location /api" "$CONFIG_FILE" | grep -q "client_max_body_size.*50M"; then
        if grep -A 10 "location /api" "$CONFIG_FILE" | grep -q "client_max_body_size"; then
            # 替换现有的
            sed -i '/location \/api {/,/}/ s/client_max_body_size.*/client_max_body_size 50M;/g' "$CONFIG_FILE"
            echo "✅ 更新了 location /api 块的 client_max_body_size"
        else
            # 添加新的
            sed -i '/location \/api {/a\        client_max_body_size 50M;' "$CONFIG_FILE"
            echo "✅ 添加了 location /api 块的 client_max_body_size"
        fi
    fi
else
    echo "⚠️  未找到 location /api 块，将在文件末尾添加"
    cat >> "$CONFIG_FILE" << 'EOF'

    location /api {
        proxy_pass http://localhost:8000;
        client_max_body_size 50M;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
EOF
fi

# 测试配置
echo ""
echo "🧪 测试配置..."
if nginx -t 2>&1; then
    echo ""
    echo "✅ 配置测试通过"
    echo "🔄 重新加载 Nginx..."
    systemctl reload nginx
    echo ""
    echo "================================"
    echo "✅ 修复完成！"
    echo "================================"
    echo ""
    echo "验证配置:"
    nginx -T 2>/dev/null | grep "client_max_body_size" || echo "（未找到）"
    echo ""
    echo "现在可以测试上传任务了！"
    echo "备份位置: $BACKUP"
else
    echo ""
    echo "❌ 配置测试失败，正在恢复备份..."
    cp "$BACKUP" "$CONFIG_FILE"
    echo "✅ 已恢复备份"
    exit 1
fi

