# 🚨 立即修复 Nginx 413 错误

## 问题确认
从控制台错误可以看到：
- **HTTP 413 Request Entity Too Large**
- **Nginx 1.24.0 (Ubuntu)**
- 这确认了是 Nginx 配置问题

## ✅ 解决方案

### 方案 1：等待自动部署（如果 GitHub Actions 正在运行）

1. 检查部署状态：https://github.com/Miever1/www-services/actions
2. 等待部署完成（会自动修复 Nginx）
3. 然后测试上传

### 方案 2：立即手动修复（如果你可以访问服务器）

**通过 GitHub Actions 立即运行修复**（推荐）：

我可以创建一个单独的工作流文件，只修复 Nginx，不部署代码。或者你可以联系部署人员。

**或者直接 SSH 到服务器运行**：

```bash
# 连接服务器（需要 SSH 密钥）
ssh -i ~/.ssh/your-key ubuntu@18.166.68.164

# 运行修复命令
sudo bash -c '
CONFIG_FILE="/etc/nginx/sites-available/default"
BACKUP="$CONFIG_FILE.backup.$(date +%Y%m%d-%H%M%S)"
sudo cp "$CONFIG_FILE" "$BACKUP"

# 添加 server 块配置
if ! grep -q "client_max_body_size.*50M" "$CONFIG_FILE"; then
  sudo sed -i "/^[[:space:]]*server[[:space:]]*{/a\    client_max_body_size 50M;" "$CONFIG_FILE" || \
  sudo sed -i "/server[[:space:]]*{/a\    client_max_body_size 50M;" "$CONFIG_FILE"
fi

# 添加 location /api 块配置
if grep -q "location[[:space:]]*/api" "$CONFIG_FILE"; then
  if ! grep -A 10 "location[[:space:]]*/api" "$CONFIG_FILE" | grep -q "client_max_body_size.*50M"; then
    sudo sed -i "/location[[:space:]]*\/api[[:space:]]*{/a\        client_max_body_size 50M;" "$CONFIG_FILE"
  fi
fi

# 测试并重载
sudo nginx -t && sudo systemctl reload nginx && echo "✅ 修复完成！" || echo "❌ 配置错误"
'
```

### 方案 3：联系部署人员

把以下信息发给帮你部署的人，让他们运行：

```
服务器出现 HTTP 413 错误，需要修复 Nginx 配置。

请在服务器上运行：
sudo sed -i "/server[[:space:]]*{/a\    client_max_body_size 50M;" /etc/nginx/sites-available/default
sudo sed -i "/location[[:space:]]*\/api[[:space:]]*{/a\        client_max_body_size 50M;" /etc/nginx/sites-available/default
sudo nginx -t && sudo systemctl reload nginx

这会让 Nginx 允许上传最大 50MB 的文件。
```

## 🔍 验证修复

修复后，检查配置：

```bash
sudo nginx -T | grep client_max_body_size
```

应该看到至少两处 `client_max_body_size 50M;`

然后测试上传照片功能。

