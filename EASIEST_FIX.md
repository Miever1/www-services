# 🚀 最简单的修复方法 - 复制粘贴即可

## 方法 1：一键运行（最简单！）

### 步骤 1：SSH 连接到服务器

在**本地终端**运行：
```bash
ssh ubuntu@18.166.68.164
```

（如果连接失败，可能需要 SSH 密钥，继续看下面的方法）

### 步骤 2：运行一键修复命令

连接成功后，**直接复制粘贴**这一整行命令：

```bash
sudo bash -c "$(curl -s https://raw.githubusercontent.com/Miever1/www-services/feature/test/fix-nginx-one-command.sh)"
```

或者如果上面的命令无法下载，手动运行：

```bash
# 备份并修复
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup && \
sudo sed -i '/server {/a\    client_max_body_size 50M;' /etc/nginx/sites-available/default && \
sudo sed -i '/location \/api {/a\        client_max_body_size 50M;' /etc/nginx/sites-available/default && \
sudo nginx -t && sudo systemctl reload nginx && echo "✅ 修复完成！"
```

就这么简单！完成！

---

## 方法 2：如果无法下载脚本

### 步骤 1：SSH 连接
```bash
ssh ubuntu@18.166.68.164
```

### 步骤 2：手动执行命令

连接后，**一条一条**运行这些命令：

```bash
# 1. 备份配置文件
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup

# 2. 添加配置（在 server 块）
sudo sed -i '/server {/a\    client_max_body_size 50M;' /etc/nginx/sites-available/default

# 3. 添加配置（在 location /api 块）
sudo sed -i '/location \/api {/a\        client_max_body_size 50M;' /etc/nginx/sites-available/default

# 4. 测试配置
sudo nginx -t

# 5. 如果测试通过，重新加载
sudo systemctl reload nginx
```

完成！

---

## 方法 3：如果找不到配置文件

### 步骤 1：找到配置文件
```bash
ssh ubuntu@18.166.68.164
sudo find /etc/nginx -name "*.conf" | grep -E "(default|baicloud)"
```

### 步骤 2：使用找到的文件名替换上面的 `default`

例如，如果找到的是 `/etc/nginx/sites-available/baicloud.miever.net`，则运行：

```bash
sudo cp /etc/nginx/sites-available/baicloud.miever.net /etc/nginx/sites-available/baicloud.miever.net.backup && \
sudo sed -i '/server {/a\    client_max_body_size 50M;' /etc/nginx/sites-available/baicloud.miever.net && \
sudo sed -i '/location \/api {/a\        client_max_body_size 50M;' /etc/nginx/sites-available/baicloud.miever.net && \
sudo nginx -t && sudo systemctl reload nginx
```

---

## ✅ 验证修复

运行这个命令检查：
```bash
sudo nginx -T | grep "client_max_body_size"
```

应该看到：
```
client_max_body_size 50M;
client_max_body_size 50M;
```

---

## 🆘 如果 SSH 连接失败

### 问题 1：需要 SSH 密钥

如果你有密钥文件（.pem 或 .key），运行：
```bash
ssh -i /path/to/your/key.pem ubuntu@18.166.68.164
```

### 问题 2：端口不是 22

```bash
ssh -p 2222 ubuntu@18.166.68.164
```

### 问题 3：不知道用户名

尝试：
```bash
ssh root@18.166.68.164
# 或
ssh admin@18.166.68.164
```

### 问题 4：需要密码但不知道

- 检查你的云服务提供商控制台
- 或者查看项目文档/笔记

---

## 📞 需要帮助？

如果遇到任何问题，请告诉我：
1. SSH 连接时看到的错误信息
2. 运行修复命令后的输出
3. `sudo nginx -t` 的结果

我可以帮你进一步诊断！

