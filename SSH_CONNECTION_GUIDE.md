# SSH 连接到服务器 - 完整指南

## 📍 你的服务器信息

- **服务器 IP**: `18.166.68.164`
- **域名**: `baicloud.miever.net`
- **用户名**: `ubuntu`

## 🔐 方法 1：使用密码连接（如果设置了密码）

### 步骤 1：打开终端

在 Mac 上：
- 按 `Cmd + Space` 打开 Spotlight
- 输入 "Terminal" 或 "终端"
- 按 Enter

### 步骤 2：运行 SSH 命令

```bash
ssh ubuntu@18.166.68.164
```

### 步骤 3：输入密码

如果提示输入密码，输入密码后按 Enter。

---

## 🔑 方法 2：使用 SSH 密钥（最常见）

### 步骤 1：检查是否已有 SSH 密钥

```bash
# 查看是否有密钥文件
ls -la ~/.ssh/

# 常见的密钥文件名：
# - id_rsa / id_rsa.pub
# - id_ed25519 / id_ed25519.pub
# - baicloud_key / baicloud_key.pem
```

### 步骤 2：如果有密钥文件，使用密钥连接

```bash
# 使用指定的密钥文件
ssh -i ~/.ssh/your-key-file.pem ubuntu@18.166.68.164

# 或者如果密钥在默认位置
ssh -i ~/.ssh/id_rsa ubuntu@18.166.68.164
```

### 步骤 3：设置密钥权限（如果遇到权限错误）

```bash
chmod 600 ~/.ssh/your-key-file.pem
ssh -i ~/.ssh/your-key-file.pem ubuntu@18.166.68.164
```

---

## 🔍 方法 3：从 GitHub Secrets 获取密钥

### 步骤 1：访问 GitHub Secrets

1. 打开浏览器，访问：
   ```
   https://github.com/Miever1/www-services/settings/secrets/actions
   ```

2. 找到 `SSH_PRIVATE_KEY` secret

3. 点击查看（可能需要输入 GitHub 密码）

### 步骤 2：保存密钥到本地

```bash
# 在本地终端运行
nano ~/.ssh/baicloud_key
```

4. 将 GitHub 中的私钥内容**完整复制粘贴**到这个文件
5. 保存：按 `Ctrl + O`，然后 `Enter`，然后 `Ctrl + X`
6. 设置权限：
   ```bash
   chmod 600 ~/.ssh/baicloud_key
   ```

### 步骤 3：使用密钥连接

```bash
ssh -i ~/.ssh/baicloud_key ubuntu@18.166.68.164
```

---

## 🌐 方法 4：通过云服务提供商控制台

如果你使用的是 AWS、DigitalOcean、Vultr 等云服务：

### AWS EC2
1. 登录 AWS Console
2. 进入 EC2 服务
3. 找到你的实例（IP: 18.166.68.164）
4. 点击 "Connect" 按钮
5. 使用 "EC2 Instance Connect" 或下载 SSH 密钥

### DigitalOcean
1. 登录 DigitalOcean
2. 进入 Droplets
3. 找到你的服务器
4. 点击 "Access" → "Launch Droplet Console"

### 其他云服务
- 查看服务商的文档，通常都有"连接到服务器"的选项

---

## ✅ 验证连接成功

连接成功后，你会看到类似这样的提示：

```
Welcome to Ubuntu...
ubuntu@ip-xxx-xxx-xxx-xxx:~$
```

或者：
```
ubuntu@your-server-name:~$
```

---

## 🆘 常见问题和解决方案

### 问题 1：连接超时
```
ssh: connect to host 18.166.68.164 port 22: Operation timed out
```

**可能原因：**
- 防火墙阻止了连接
- 服务器未运行
- IP 地址错误

**解决方案：**
```bash
# 测试服务器是否在线
ping 18.166.68.164

# 测试端口是否开放
telnet 18.166.68.164 22
```

### 问题 2：权限被拒绝
```
Permission denied (publickey)
```

**解决方案：**
- 确保使用了正确的密钥文件
- 检查密钥文件权限：`chmod 600 ~/.ssh/your-key`
- 确认用户名正确（可能是 `root` 而不是 `ubuntu`）

### 问题 3：找不到密钥文件
```
ssh: Could not resolve hostname
```

**解决方案：**
- 检查密钥文件路径是否正确
- 使用绝对路径：`ssh -i /完整路径/to/key.pem ubuntu@18.166.68.164`

### 问题 4：端口不是 22

```bash
# 如果服务器使用其他端口（比如 2222）
ssh -p 2222 ubuntu@18.166.68.164
```

---

## 🧪 快速测试命令

尝试运行这些命令，看哪个能连接：

```bash
# 尝试 1：基本连接
ssh ubuntu@18.166.68.164

# 尝试 2：使用 root 用户
ssh root@18.166.68.164

# 尝试 3：详细输出（查看错误信息）
ssh -v ubuntu@18.166.68.164

# 尝试 4：测试连接但不执行命令
ssh -T ubuntu@18.166.68.164
```

---

## 💡 如果你有其他访问方式

如果你可以通过其他方式访问服务器（比如 Web 控制台、VNC 等），你也可以：
1. 通过控制台访问服务器
2. 直接运行修复命令

告诉我你现在的情况，我可以帮你选择最合适的方法！

