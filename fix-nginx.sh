#!/bin/bash
# Nginx 配置修复脚本
# 这个脚本会帮助你在服务器上修复 Nginx 配置

echo "========================================="
echo "Nginx 配置修复脚本"
echo "========================================="
echo ""

# 1. 查找 Nginx 配置文件
echo "步骤 1: 查找 Nginx 配置文件..."
echo ""

# 检查 sites-available
if [ -d "/etc/nginx/sites-available" ]; then
    echo "找到 /etc/nginx/sites-available/ 目录："
    ls -la /etc/nginx/sites-available/
    echo ""
fi

# 检查 sites-enabled
if [ -d "/etc/nginx/sites-enabled" ]; then
    echo "找到 /etc/nginx/sites-enabled/ 目录："
    ls -la /etc/nginx/sites-enabled/
    echo ""
fi

# 检查主配置文件
if [ -f "/etc/nginx/nginx.conf" ]; then
    echo "找到主配置文件: /etc/nginx/nginx.conf"
    echo ""
fi

# 查找包含 baicloud 的配置
echo "查找包含 'baicloud' 的配置文件："
find /etc/nginx -name "*.conf" -type f -exec grep -l "baicloud" {} \; 2>/dev/null
echo ""

# 检查当前配置
echo "当前 client_max_body_size 配置："
nginx -T 2>/dev/null | grep -i "client_max_body_size" || echo "未找到 client_max_body_size 配置"
echo ""

# 检查 /api location 配置
echo "当前 /api location 配置："
nginx -T 2>/dev/null | grep -A 10 "location /api" || echo "未找到 /api location 配置"
echo ""

echo "========================================="
echo "下一步操作："
echo "========================================="
echo "1. 根据上面的输出，找到你的配置文件"
echo "2. 使用以下命令编辑："
echo "   sudo nano /etc/nginx/sites-available/default"
echo "   （或使用上面列出的配置文件路径）"
echo ""
echo "3. 在配置文件中添加或修改："
echo "   client_max_body_size 50M;"
echo ""
echo "4. 保存后测试配置："
echo "   sudo nginx -t"
echo ""
echo "5. 如果测试通过，重新加载："
echo "   sudo systemctl reload nginx"

