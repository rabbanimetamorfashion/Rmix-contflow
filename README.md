# ContentFlow (Production Job Order Management) - IT Deployment Guide

This extremely detailed guide is written for System Administrators and IT personnel to deploy the ContentFlow web application onto a company-owned Linux server (Assuming **Ubuntu 20.04 / 22.04 LTS** or Debian-based equivalent).

The application architecture is: **Vite (React JS) Frontend + Express (Node JS) Backend Server + Firebase (NoSQL Database & Authentication)**. 

The target production URL for this guide is: **`https://taskmarketing.rsys.systems`**

---

## 🏗 Phase 1: Server Preparation

Log into your server via SSH as `root` or a user with `sudo` privileges. Run all the following commands to ensure the server has the necessary software.

### 1. Update the System
```bash
sudo apt update
sudo apt upgrade -y
```

### 2. Install Git and Nginx
Nginx will be used as the reverse proxy to expose the app to the internet.
```bash
sudo apt install git nginx -y
```

### 3. Install Node.js (Version 20.x LTS)
We need modern Node.js installed to run the application. We will use the official NodeSource repository.
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```
Verify the installation:
```bash
node -v   # Should output v20...
npm -v    # Should output 10... (or similar)
```

### 4. Install PM2 globally
PM2 is a production process manager for Node.js. It will keep the server running in the background and automatically restart it if it crashes or if the server reboots.
```bash
sudo npm install -g pm2
```

---

## 🌐 Phase 2: DNS Routing

Before proceeding with SSL generation later, you must point the domain to this server.
1. Log into your domain registrar's DNS manager (for `rsys.systems`).
2. Add an **A Record**:
   - **Host/Name:** `taskmarketing`
   - **Value/Target:** `<YOUR_SERVER_PUBLIC_IP_ADDRESS>`
   - **TTL:** Auto / Default

---

## 🚀 Phase 3: Application Deployment

### 1. Create the App Directory
```bash
sudo mkdir -p /var/www/taskmarketing
sudo chown -R $USER:$USER /var/www/taskmarketing
cd /var/www/taskmarketing
```

### 2. Clone the Repository
*(Replace the URL below with the actual Git repository URL of this project)*
```bash
git clone <YOUR_GITHUB_REPO_URL> .
```

### 3. Install NPM Dependencies
This downloads all required libraries securely to the `node_modules` folder.
```bash
npm install
```

### 4. Configure Environment Variables
Copy the template environment file.
```bash
cp .env.example .env
```
Open the `.env` file and verify or update the variables:
```bash
nano .env
```
Ensure `APP_URL` is set to `https://taskmarketing.rsys.systems` if required by the app, and save (`CTRL + X`, then `Y`, then `Enter`).

### 5. Build the Production Application
This command compiles the React frontend into highly optimized static HTML/CSS/JS files inside the `/dist` folder.
```bash
npm run build
```

---

## ⚙️ Phase 4: Start the Application with PM2

Now we will start the Express backend server (which also serves the compiled React app) on port `3000`.

### 1. Start the app
```bash
pm2 start npm --name "taskmarketing-app" -- start
```

### 2. Instruct PM2 to start on server boot
```bash
pm2 startup
```
*(Copy and paste the exact command PM2 outputs on the screen to finalize the startup script, then run it).*

### 3. Save the PM2 configuration
```bash
pm2 save
```
The app is now running locally on exactly `http://localhost:3000`.

---

## 🛡️ Phase 5: Nginx Reverse Proxy & SSL (HTTPS)

We need to map port 80 (HTTP) to port 3000, and secure it with port 443 (HTTPS) via SSL. **Google Authentication will fail outright if the site does not have a valid SSL certificate.**

### 1. Create the Nginx Configuration Block
```bash
sudo nano /etc/nginx/sites-available/taskmarketing
```

### 2. Paste the Reverse Proxy Config
Paste the following exact configuration into the nano editor:
```nginx
server {
    listen 80;
    server_name taskmarketing.rsys.systems;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Save and exit (`CTRL + X`, then `Y`, then `Enter`).

### 3. Enable the Site in Nginx
```bash
sudo ln -s /etc/nginx/sites-available/taskmarketing /etc/nginx/sites-enabled/
```

### 4. Test and Restart Nginx
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### 5. Install Certbot and Generate requested SSL
Certbot will automatically fetch a free Let's Encrypt SSL certificate and modify the Nginx config to forcefully redirect HTTP traffic to HTTPS securely.
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d taskmarketing.rsys.systems
```
Follow the screen prompts (enter an IT email address, accept terms, etc.).

---

## 🔐 Phase 6: Google Login Authorization (CRITICAL)

Because the application is now living on `taskmarketing.rsys.systems`, Google's Firebase security will automatically block any login popup attempts. **You must whitelist this domain in the Firebase console.**

1. Log into your Google Cloud / Firebase Console.
2. Select the existing project: `gen-lang-client-0162825138` (or the one matching `firebase-applet-config.json`).
3. On the left sidebar, click **Authentication**, then change to the **Settings** tab.
4. From the horizontal menu (or left sidebar depending on UI version), click **Authorized domains**.
5. Click **Add Domain** and explicitly enter: `taskmarketing.rsys.systems`
6. Click **Add**.

*(Note: The `firebase-applet-config.json` inside the repository defines the keys to connect to the database. These are safe to be public as database security is enforced completely mathematically by the backend Security Rules via Firestore, not by keeping the connection string hidden).*

---

## 🛠 Useful IT Commands for Maintenance

**To view live app logs (useful for debugging errors):**
```bash
pm2 logs taskmarketing-app
```

**Restart the app after pushing git updates:**
```bash
cd /var/www/taskmarketing
git pull
npm install
npm run build
pm2 restart taskmarketing-app
```

**Verify Firewall Status (if site isn't loading):**
```bash
sudo ufw status
# If active, make sure you allow Nginx HTTP/HTTPS:
# sudo ufw allow 'Nginx Full'
# sudo ufw allow OpenSSH
```
