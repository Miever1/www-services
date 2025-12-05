#!/bin/bash
# 自动修复 Nginx 配置脚本
# 使用方法：在服务器上运行：bash auto-fix-nginx.sh

set -e  # 遇到错误立即退出

echo "========================================="
echo "Nginx 配置自动修复脚本"
echo "========================================="
echo ""

# 检查是否有 root 权限
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  需要 root 权限，请使用 sudo 运行："
    echo "   sudo bash auto-fix-nginx.sh"
    exit 1
fi

# 备份配置文件
echo "步骤 1: 备份配置文件..."
BACKUP_DIR="/tmp/nginx-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 查找所有可能的配置文件
CONFIG_FILES=()

# 检查 sites-available
if [ -d "/etc/nginx/sites-available" ]; then
    for file in /etc/nginx/sites-available/*; do
        if [ -f "$file" ] && ! [ -L "$file" ]; then
            CONFIG_FILES+=("$file")
            cp "$file" "$BACKUP_DIR/$(basename $file)" 2>/dev/null || true
        fi
    done
fi

# 检查主配置文件
if [ -f "/etc/nginx/nginx.conf" ]; then
    CONFIG_FILES+=("/etc/nginx/nginx.conf")
    cp /etc/nginx/nginx.conf "$BACKUP_DIR/nginx.conf" 2>/dev/null || true
fi

echo "✅ 配置文件已备份到: $BACKUP_DIR"
echo ""

# 查找包含 baicloud 或 /api 的配置文件
echo "步骤 2: 查找需要修改的配置文件..."
TARGET_FILE=""

for file in "${CONFIG_FILES[@]}"; do
    if grep -q "baicloud\|location /api\|proxy_pass.*8000" "$file" 2>/dev/null; then
        TARGET_FILE="$file"
        echo "✅ 找到目标配置文件: $file"
        break
    fi
done

# 如果没找到，使用 default
if [ -z "$TARGET_FILE" ] && [ -f "/etc/nginx/sites-available/default" ]; then
    TARGET_FILE="/etc/nginx/sites-available/default"
    echo "✅ 使用默认配置文件: $TARGET_FILE"
fi

if [ -z "$TARGET_FILE" ]; then
    echo "❌ 未找到配置文件，请手动指定"
    echo "可用的配置文件："
    printf '%s\n' "${CONFIG_FILES[@]}"
    exit 1
fi

echo ""

# 检查当前配置
echo "步骤 3: 检查当前配置..."
if grep -q "client_max_body_size" "$TARGET_FILE"; then
    echo "当前 client_max_body_size 设置："
    grep "client_max_body_size" "$TARGET_FILE" || true
else
    echo "⚠️  未找到 client_max_body_size 配置"
fi
echo ""

# 修改配置
echo "步骤 4: 修改配置文件..."

# 创建临时文件
TEMP_FILE=$(mktemp)

# 读取原文件
cat "$TARGET_FILE" > "$TEMP_FILE"

# 检查 server 块中是否有 client_max_body_size
if ! grep -q "client_max_body_size" "$TEMP_FILE" || grep -q "client_max_body_size.*[0-9]M" "$TEMP_FILE" && ! grep -q "client_max_body_size.*50M" "$TEMP_FILE"; then
    echo "   - 在 server 块中添加/更新 client_max_body_size..."
    
    # 使用 sed 在 server { 后添加配置
    if grep -q "server {" "$TEMP_FILE"; then
        # 如果 server 块中没有 client_max_body_size，添加它
        if ! grep -A 5 "server {" "$TEMP_FILE" | grep -q "client_max_body_size"; then
            sed -i '/server {/a\    client_max_body_size 50M;' "$TEMP_FILE"
        else
            # 如果存在但值不对，替换它
            sed -i 's/client_max_body_size.*/client_max_body_size 50M;/g' "$TARGET_FILE"
        fi
    fi
fi

# 检查 location /api 块
if grep -q "location /api" "$TEMP_FILE"; then
    echo "   - 在 location /api 块中添加/更新 client_max_body_size..."
    
    # 检查 location /api 块中是否有 client_max_body_size
    if ! grep -A 10 "location /api" "$TEMP_FILE" | grep -q "client_max_body_size"; then
        # 在 location /api { 后添加
        sed -i '/location \/api {/a\        client_max_body_size 50M;' "$TEMP_FILE"
    else
        # 如果存在但值不对，替换它
        sed -i '/location \/api {/,/}/ s/client_max_body_size.*/client_max_body_size 50M;/g' "$TEMP_FILE"
    fi
else
    echo "   ⚠️  未找到 location /api 块，可能需要手动添加"
fi

# 显示修改后的关键部分
echo ""
echo "修改后的关键配置："
grep -A 2 "client_max_body_size" "$TEMP_FILE" || echo "（未找到）"
echo ""

# 询问确认
read -p "是否应用这些更改？(y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # 应用更改
    cp "$TEMP_FILE" "$TARGET_FILE"
    echo "✅ 配置文件已更新"
    
    # 测试配置
    echo ""
    echo "步骤 5: 测试 Nginx 配置..."
    if nginx -t; then
        echo "✅ 配置测试通过"
        
        # 重新加载
        echo ""
        echo "步骤 6: 重新加载 Nginx..."
        if systemctl reload nginx; then
            echo "✅ Nginx 已重新加载"
            echo ""
            echo "========================================="
            echo "✅ 修复完成！"
            echo "========================================="
            echo ""
            echo "验证配置："
            nginx -T 2>/dev/null | grep "client_max_body_size" || echo "（未找到）"
            echo ""
            echo "现在可以测试上传任务了！"
        else
            echo "❌ Nginx 重新加载失败"
            echo "配置文件已备份在: $BACKUP_DIR"
            exit 1
        fi
    else
        echo "❌ 配置测试失败"
        echo "正在恢复备份..."
        cp "$BACKUP_DIR/$(basename $TARGET_FILE)" "$TARGET_FILE"
        echo "✅ 已恢复备份"
        exit 1
    fi
else
    echo "❌ 已取消修改"
    rm -f "$TEMP_FILE"
    exit 0
fi

# 清理临时文件
rm -f "$TEMP_FILE"

echo ""
echo "备份位置: $BACKUP_DIR"
echo "如需恢复，运行: cp $BACKUP_DIR/$(basename $TARGET_FILE) $TARGET_FILE"

