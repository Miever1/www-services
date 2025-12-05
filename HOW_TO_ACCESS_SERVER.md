# 如何访问你的服务器

## 🔍 第一步：找到服务器信息

### 方法 1：检查 GitHub Secrets

服务器信息可能存储在 GitHub Secrets 中：

1. 访问你的 GitHub 仓库：https://github.com/Miever1/www-services
2. 点击 **Settings** → **Secrets and variables** → **Actions**
3. 查找以下 secrets：
   - `SERVER_IP` - 服务器 IP 地址
   - `SSH_PRIVATE_KEY` - SSH 私钥

### 方法 2：检查部署记录

查看 GitHub Actions 的部署日志：
1. 访问：https://github.com/Miever1/www-services/actions
2. 打开最近的 "Development-Deploy" workflow
3. 查看日志，可能会显示服务器连接信息

### 方法 3：检查域名 DNS

如果你的域名是 `baicloud.miever.net`，可以通过 DNS 查找 IP：

```bash
# 在本地终端运行
nslookup baicloud.miever.net
# 或
dig baicloud.miever.net
```

## 🔐 第二步：SSH 连接

一旦知道了服务器 IP，使用以下命令连接：

```bash
# 基本连接
ssh ubuntu@your-server-ip

# 如果需要指定 SSH 密钥
ssh -i /path/to/your/private/key ubuntu@your-server-ip

# 如果使用不同的用户名
ssh username@your-server-ip
```

## 📝 常见连接方式

### 方式 1：使用密码
```bash
ssh ubuntu@your-server-ip
# 然后输入密码
```

### 方式 2：使用 SSH 密钥
```bash
# 如果有私钥文件
ssh -i ~/.ssh/your-key.pem ubuntu@your-server-ip
```

### 方式 3：如果端口不是 22
```bash
ssh -p 2222 ubuntu@your-server-ip
```

## 🆘 如果无法连接

### 检查网络
```bash
# 测试服务器是否在线
ping your-server-ip

# 测试端口是否开放
telnet your-server-ip 22
```

### 检查 SSH 服务
```bash
# 在服务器上检查（如果有其他方式访问）
sudo systemctl status ssh
```

## 💡 如果你不知道服务器信息

1. **检查你的云服务提供商**
   - AWS EC2
   - DigitalOcean
   - Linode
   - Vultr
   - 等等

2. **检查部署脚本中的信息**
   - 查看 `.github/workflows/development.yml`
   - 查看部署相关的文档

3. **询问团队成员**
   - 如果是团队项目，询问其他成员

## 📋 连接成功后

一旦成功连接，你会看到类似这样的提示符：
```
ubuntu@your-server-name:~$
```

然后你就可以运行修复命令了。

