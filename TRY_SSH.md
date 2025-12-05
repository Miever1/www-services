# 尝试 SSH 连接 - 快速指南

## 🚀 最简单的方法：直接尝试

### 在你的 Mac 终端中，按顺序尝试这些命令：

#### 尝试 1：使用默认密钥
```bash
ssh ubuntu@18.166.68.164
```

#### 尝试 2：使用 id_rsa 密钥
```bash
ssh -i ~/.ssh/id_rsa ubuntu@18.166.68.164
```

#### 尝试 3：使用 id_ed25519 密钥
```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@18.166.68.164
```

#### 尝试 4：尝试 root 用户
```bash
ssh root@18.166.68.164
```

---

## 📋 如果以上都不行

### 方法 A：从 GitHub 获取 SSH 密钥

1. **访问 GitHub Secrets**
   - 打开：https://github.com/Miever1/www-services/settings/secrets/actions
   - 找到 `SSH_PRIVATE_KEY`
   - 复制私钥内容

2. **保存到本地**
   ```bash
   # 创建密钥文件
   nano ~/.ssh/baicloud_server_key
   
   # 粘贴私钥内容（完整复制，包括 -----BEGIN 和 -----END 行）
   # 保存：Ctrl+O, Enter, Ctrl+X
   
   # 设置权限
   chmod 600 ~/.ssh/baicloud_server_key
   
   # 使用密钥连接
   ssh -i ~/.ssh/baicloud_server_key ubuntu@18.166.68.164
   ```

### 方法 B：通过云服务控制台

如果你知道使用的云服务（AWS、阿里云、腾讯云等）：
- 登录控制台
- 找到服务器
- 使用"连接"或"远程连接"功能

---

## 💡 连接成功后

一旦连接成功，你会看到：
```
ubuntu@xxx:~$
```

然后运行修复命令：
```bash
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup && sudo sed -i '/server {/a\    client_max_body_size 50M;' /etc/nginx/sites-available/default && sudo sed -i '/location \/api {/a\        client_max_body_size 50M;' /etc/nginx/sites-available/default && sudo nginx -t && sudo systemctl reload nginx && echo "✅ 修复完成！"
```

---

## 🆘 还是不行？

告诉我：
1. 运行 `ssh ubuntu@18.166.68.164` 时看到了什么错误信息？
2. 你的服务器是从哪里买的？（AWS、阿里云、腾讯云等）
3. 你是否记得服务器的登录方式？

我可以提供更具体的帮助！

