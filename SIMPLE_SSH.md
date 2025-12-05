# 🚀 SSH 连接 - 超简单版本

## 步骤 1：打开终端

在 Mac 上按 `Cmd + Space`，输入 "Terminal"，回车。

## 步骤 2：运行这个命令

**直接复制粘贴这一行：**

```bash
ssh -o StrictHostKeyChecking=no ubuntu@18.166.68.164
```

按 `Enter`。

## 步骤 3：如果提示输入密码

- 输入密码后按 `Enter`
- 如果不知道密码，继续看下面的方法

## 步骤 4：如果提示 "Permission denied"

说明需要 SSH 密钥。运行：

```bash
# 尝试使用本地密钥
ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_rsa ubuntu@18.166.68.164
```

---

## 🔑 如果需要从 GitHub 获取密钥

### 1. 打开浏览器，访问：
```
https://github.com/Miever1/www-services/settings/secrets/actions
```

### 2. 找到 `SSH_PRIVATE_KEY`，点击查看

### 3. 复制私钥内容（完整的，包括开头和结尾）

### 4. 在终端运行：

```bash
# 创建密钥文件
nano ~/.ssh/server_key

# 粘贴私钥（右键粘贴，或者 Cmd+V）
# 保存：按 Ctrl+O，然后 Enter，然后 Ctrl+X

# 设置权限
chmod 600 ~/.ssh/server_key

# 连接
ssh -o StrictHostKeyChecking=no -i ~/.ssh/server_key ubuntu@18.166.68.164
```

---

## ✅ 连接成功后

你会看到类似这样的提示：
```
ubuntu@xxx:~$
```

然后就可以运行修复命令了！

---

## 📞 如果还是连接不上

告诉我你看到的具体错误信息，我帮你解决！

