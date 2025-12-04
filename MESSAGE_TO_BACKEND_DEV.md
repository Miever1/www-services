# Message to Backend Developer (English)

## Quick Fix Needed for Nginx Configuration

Hi [Backend Developer Name],

We're experiencing an **HTTP 413 (Request Entity Too Large)** error when users try to upload photos on our deployed site. This is preventing users from creating posts with images.

**Problem:**
- Error: `413 Request Entity Too Large`
- Nginx version: 1.24.0 (Ubuntu)
- Server IP: 18.166.68.164
- Domain: baicloud.miever.net

**Root Cause:**
The Nginx configuration has a default `client_max_body_size` of 1MB, which is too small for image uploads. We need to increase it to 50MB.

**Solution:**
Please run the following command on the server to fix this:

```bash
sudo bash -c '
CONFIG_FILE="/etc/nginx/sites-available/default"
BACKUP="$CONFIG_FILE.backup.$(date +%Y%m%d-%H%M%S)"
sudo cp "$CONFIG_FILE" "$BACKUP"

# Add client_max_body_size to server block
if ! grep -q "client_max_body_size.*50M" "$CONFIG_FILE"; then
  sudo sed -i "/server[[:space:]]*{/a\    client_max_body_size 50M;" "$CONFIG_FILE"
  echo "✅ Added client_max_body_size 50M to server block"
fi

# Add client_max_body_size to location /api block
if grep -q "location[[:space:]]*/api" "$CONFIG_FILE"; then
  if ! grep -A 10 "location[[:space:]]*/api" "$CONFIG_FILE" | grep -q "client_max_body_size.*50M"; then
    sudo sed -i "/location[[:space:]]*\/api[[:space:]]*{/a\        client_max_body_size 50M;" "$CONFIG_FILE"
    echo "✅ Added client_max_body_size 50M to location /api block"
  fi
fi

# Test and reload
if sudo nginx -t; then
  sudo systemctl reload nginx
  echo "✅ Nginx configuration updated and reloaded successfully"
  echo ""
  echo "Verification:"
  sudo nginx -T 2>/dev/null | grep "client_max_body_size"
else
  echo "❌ Configuration test failed, backup restored"
  sudo cp "$BACKUP" "$CONFIG_FILE"
  exit 1
fi
'
```

**Alternative (if you prefer to edit manually):**

1. Edit the Nginx config:
   ```bash
   sudo nano /etc/nginx/sites-available/default
   ```

2. Find the `server {` block and add at the first line:
   ```nginx
   server {
       client_max_body_size 50M;  # Add this line
       ...
   }
   ```

3. Find the `location /api {` block and add at the first line:
   ```nginx
   location /api {
       client_max_body_size 50M;  # Add this line
       ...
   }
   ```

4. Test configuration:
   ```bash
   sudo nginx -t
   ```

5. If test passes, reload Nginx:
   ```bash
   sudo systemctl reload nginx
   ```

**Verification:**
After the fix, verify with:
```bash
sudo nginx -T | grep client_max_body_size
```

You should see at least two instances of `client_max_body_size 50M;`

**Notes:**
- The script creates a backup automatically before making changes
- If the configuration test fails, it will restore the backup
- This change only affects request size limits, not security

**After fixing:**
Once this is done, users should be able to upload photos without the 413 error.

Thank you!

---

**If you need SSH access:**
- Server: ubuntu@18.166.68.164
- You should have SSH keys configured in GitHub Secrets (`SSH_PRIVATE_KEY`)

