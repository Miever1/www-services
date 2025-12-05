# 🚨 紧急修复 Nginx 413 错误

## 问题确认
从错误日志看到仍然是 **HTTP 413 Request Entity Too Large**，说明 Nginx 配置还没有修复。

## ⚡ 立即修复方案

### 方法 1：检查 GitHub Actions 部署日志

1. 访问：https://github.com/Miever1/www-services/actions
2. 查看最新的 **Development** 运行
3. 找到 **"Fix Nginx config for large file uploads"** 步骤
4. 检查是否有错误

如果步骤失败或没有执行，说明部署流程有问题。

### 方法 2：直接在服务器上运行修复命令

**如果你可以访问服务器**，运行：

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
  echo "✅ 添加了 server 块配置"
fi

# 添加 location /api 块配置
if grep -q "location[[:space:]]*/api" "$CONFIG_FILE"; then
  if ! grep -A 10 "location[[:space:]]*/api" "$CONFIG_FILE" | grep -q "client_max_body_size.*50M"; then
    sudo sed -i "/location[[:space:]]*\/api[[:space:]]*{/a\        client_max_body_size 50M;" "$CONFIG_FILE"
    echo "✅ 添加了 location /api 块配置"
  fi
fi

# 测试并重载
if sudo nginx -t; then
  sudo systemctl reload nginx
  echo "✅ Nginx 配置已更新并重载"
  echo ""
  echo "验证配置:"
  sudo nginx -T 2>/dev/null | grep "client_max_body_size" || echo "（未找到）"
else
  echo "❌ 配置测试失败，已恢复备份"
  sudo cp "$BACKUP" "$CONFIG_FILE"
fi
'
```

### 方法 3：联系部署人员

如果无法访问服务器，把以下信息发给帮你部署的人：

```
需要在服务器上修复 Nginx 配置以支持照片上传（解决 HTTP 413 错误）。

请在服务器上运行以下命令：

sudo bash -c '
CONFIG_FILE="/etc/nginx/sites-available/default"
BACKUP="$CONFIG_FILE.backup.$(date +%Y%m%d-%H%M%S)"
sudo cp "$CONFIG_FILE" "$BACKUP"

if ! grep -q "client_max_body_size.*50M" "$CONFIG_FILE"; then
  sudo sed -i "/server[[:space:]]*{/a\    client_max_body_size 50M;" "$CONFIG_FILE"
fi

if grep -q "location[[:space:]]*/api" "$CONFIG_FILE"; then
  if ! grep -A 10 "location[[:space:]]*/api" "$CONFIG_FILE" | grep -q "client_max_body_size.*50M"; then
    sudo sed -i "/location[[:space:]]*\/api[[:space:]]*{/a\        client_max_body_size 50M;" "$CONFIG_FILE"
  fi
fi

sudo nginx -t && sudo systemctl reload nginx && echo "✅ 修复完成！"
'
```

完成后告诉我，我会继续帮你解决其他问题。

---

## 关于 startsWith 错误

`startsWith` 错误应该已经修复了，但可能部署还没有更新。等待前端代码部署完成后，这个错误应该会消失。

