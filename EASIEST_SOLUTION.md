# 🚀 最简单的解决方案

## ❌ 问题
GitHub Settings 404 错误，无法直接获取 SSH 密钥。

## ✅ 解决方案：使用 Web 控制台（推荐）

如果你有云服务的 Web 控制台访问权限，这是最简单的方法：

### 步骤 1：登录云服务控制台
根据你的服务器提供商：

#### AWS EC2：
1. 访问：https://console.aws.amazon.com/ec2/
2. 找到 IP 为 `18.166.68.164` 的实例
3. 选中实例 → 点击 "Connect" 按钮
4. 选择 "EC2 Instance Connect" 或 "Session Manager"
5. 在浏览器中直接打开终端

#### 阿里云 ECS：
1. 访问：https://ecs.console.aliyun.com/
2. 找到你的实例
3. 点击 "远程连接" → "Web Terminal"
4. 在浏览器中打开终端

#### 腾讯云 CVM：
1. 访问：https://console.cloud.tencent.com/cvm/
2. 找到你的实例
3. 点击 "登录" → "标准登录方式"
4. 在浏览器中打开终端

#### DigitalOcean：
1. 访问：https://cloud.digitalocean.com/droplets
2. 找到你的 Droplet
3. 点击 "Access" → "Launch Droplet Console"
4. 在浏览器中打开终端

### 步骤 2：在 Web 终端中运行修复命令
一旦连接到服务器，直接运行：

```bash
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup && sudo sed -i '/server {/a\    client_max_body_size 50M;' /etc/nginx/sites-available/default && sudo sed -i '/location \/api {/a\        client_max_body_size 50M;' /etc/nginx/sites-available/default && sudo nginx -t && sudo systemctl reload nginx && echo "✅ 修复完成！"
```

完成！✅

---

## 🔍 方法 2：检查本地是否已有正确的密钥

运行这些命令：

```bash
# 尝试所有本地密钥
for key in ~/.ssh/id_rsa ~/.ssh/id_ed25519 ~/.ssh/*.pem ~/.ssh/*.key; do
  if [ -f "$key" ]; then
    echo "尝试使用: $key"
    ssh -i "$key" -o ConnectTimeout=5 ubuntu@18.166.68.164 "echo '✅ 成功连接!'" 2>&1 | head -3
    echo "---"
  fi
done
```

---

## 🔍 方法 3：正确的 GitHub Secrets URL

尝试这个完整路径：

```
https://github.com/Miever1/www-services/settings/secrets/actions
```

或者：

1. 先访问仓库主页：`https://github.com/Miever1/www-services`
2. 点击顶部的 **"Settings"** 标签（需要管理员权限）
3. 左侧菜单：**"Secrets and variables"** → **"Actions"**
4. 找到 `SSH_PRIVATE_KEY`

---

## 💡 推荐方案

**最快的方法**：使用云服务的 Web 控制台，无需 SSH 密钥！

告诉我：
1. 你的服务器是从哪里买的？
2. 你可以访问云服务的控制台吗？

我可以提供更具体的步骤！

