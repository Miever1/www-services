# 获取 SSH 密钥并连接服务器

## ✅ 好消息
你已经可以连接到服务器了！只是需要正确的 SSH 密钥。

## 🔑 步骤 1：从 GitHub 获取 SSH 密钥

### 1. 打开浏览器，访问：
```
https://github.com/Miever1/www-services/settings/secrets/actions
```

### 2. 找到 `SSH_PRIVATE_KEY`
- 点击这个 secret
- 可能需要输入 GitHub 密码

### 3. 点击"复制"按钮（或者手动选中全部内容复制）

## 💾 步骤 2：保存密钥到本地

### 在终端中运行这些命令（一行一行运行）：

```bash
# 1. 创建密钥文件
nano ~/.ssh/baicloud_key
```

### 然后：
1. **粘贴私钥内容**（在终端中右键点击，选择"粘贴"，或按 `Cmd + V`）
2. **重要**：确保粘贴完整，包括：
   - 开头的 `-----BEGIN OPENSSH PRIVATE KEY-----` 或 `-----BEGIN RSA PRIVATE KEY-----`
   - 结尾的 `-----END OPENSSH PRIVATE KEY-----` 或 `-----END RSA PRIVATE KEY-----`
3. **保存文件**：
   - 按 `Ctrl + O`（保存）
   - 按 `Enter`（确认文件名）
   - 按 `Ctrl + X`（退出）

### 继续运行：

```bash
# 2. 设置正确的权限（很重要！）
chmod 600 ~/.ssh/baicloud_key

# 3. 使用密钥连接
ssh -i ~/.ssh/baicloud_key ubuntu@18.166.68.164
```

## ✅ 如果连接成功

你会看到：
```
ubuntu@xxx:~$
```

然后就可以运行修复命令了！

---

## 🆘 如果还是不行

### 检查密钥文件是否正确：
```bash
# 查看密钥文件前几行
head -1 ~/.ssh/baicloud_key

# 应该看到类似：
# -----BEGIN OPENSSH PRIVATE KEY-----
# 或
# -----BEGIN RSA PRIVATE KEY-----
```

### 或者尝试不同的密钥格式：
```bash
# 如果密钥格式不对，可能需要转换
ssh-keygen -p -f ~/.ssh/baicloud_key -m PEM
```

---

## 📋 完整命令序列（复制粘贴版）

如果你已经复制了 GitHub 中的私钥，可以一行一行运行：

```bash
# 步骤 1: 创建并编辑密钥文件
nano ~/.ssh/baicloud_key
# （然后粘贴私钥，保存：Ctrl+O, Enter, Ctrl+X）

# 步骤 2: 设置权限
chmod 600 ~/.ssh/baicloud_key

# 步骤 3: 连接
ssh -i ~/.ssh/baicloud_key ubuntu@18.166.68.164
```

