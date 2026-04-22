# ContentFlow (Production Job Order Management)

This repository contains the source code for the ContentFlow application, a production job order management and progress tracking system for creative content teams. It is built using React, Vite, Tailwind CSS, an Express-based Node server, and Firebase (Authentication & Firestore).

Follow these step-by-step instructions to deploy this application on your company's proprietary server and hosting infrastructure.

---

## 📋 Prerequisites

Before you begin, ensure your company server has the following installed:
- **Node.js**: Version 18.x or 20.x (Recommended)
- **Git**: To clone the repository
- **NPM** (comes with Node.js)
- A process manager like **PM2** (Highly recommended to keep the app running in the background)
- A web server like **Nginx** or **Apache** (To point your domain name to the application's port)

---

## 🚀 Step-by-Step Deployment Guide

### Step 1: Clone the Repository to the Server
SSH into your company server and navigate to the directory where you want to host the web application.

```bash
cd /var/www/  # Or your preferred directory
git clone <your-github-repo-url>
cd <your-repo-folder-name>
```

### Step 2: Install Dependencies
Run the following command to download and install all necessary Node modules required by the web app and server.

```bash
npm install
```

### Step 3: Configure Environment Variables
If your application uses environment variables (like API keys), create your `.env` file. You can copy the provided example file:

```bash
cp .env.example .env
```
Open the `.env` file using a text editor (like `nano` or `vim`) and fill in your actual production values (such as your `GEMINI_API_KEY` or `APP_URL`).

### Step 4: Build the Application
You must compile the Vite React frontend into static, production-ready files. The Express server will serve these files.

```bash
npm run build
```
*(This commands generates a `/dist` folder containing the optimized production frontend).*

### Step 5: Start the Production Server
The application needs to be started securely. By default, it will run on port `3000`. 

**Option A: Basic Start (For Testing)**
```bash
npm start
```

**Option B: Production Start using PM2 (Recommended)**
If you close your SSH terminal, the standard `npm start` command will stop. PM2 runs the app in the background permanently and restarts it if the server crashes.

1. Install PM2 globally (if you haven't already):
   ```bash
   sudo npm install -g pm2
   ```
2. Start the application with PM2:
   ```bash
   pm2 start npm --name "contentflow-app" -- start
   ```
3. Ensure PM2 restarts automatically if the physical server reboots:
   ```bash
   pm2 startup
   pm2 save
   ```

---

## 🔐 CRITICAL: Firebase Google Login Configuration
Because you are moving the application to your company's custom domain name or IP address, **Google Login will fail automatically** unless you explicitly whitelist your domain in Firebase.

1. Log into the [Firebase Console](https://console.firebase.google.com/).
2. Select the Firebase project associated with this app (`gen-lang-client-0162825138`).
3. On the left sidebar, click **Authentication**, then select the **Settings** tab.
4. From the left sidebar of the settings area, click on **Authorized domains**.
5. Click **Add Domain** and enter your exact production domain: `taskmarketing.rsys.systems`.
6. Save the settings. Login popups will now work normally on your company server.

*(Note: Your `firebase-applet-config.json` doesn't need to be hidden or secured via environment variables; it is completely safe to be public on the client. Security is enforced entirely by the Firestore Security Rules we deployed).*

---

## 🌐 Step 6: Web Server & DNS Configuration (Nginx Example)

To serve the app on `taskmarketing.rsys.systems`, you need to:
1. Ensure your **DNS A-Record** for `taskmarketing.rsys.systems` points to your server's IP address.
2. Set up a reverse proxy. By default, the Express server listens on port `3000`. 

Here is the exact **Nginx** configuration block (`/etc/nginx/sites-available/taskmarketing`):

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

Once configured, enable it and install an SSL certificate (HTTPS is required for Google Login):
```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/taskmarketing /etc/nginx/sites-enabled/
# Verify syntax
sudo nginx -t
# Restart Nginx
sudo systemctl restart nginx
# Install free SSL via Certbot (highly recommended)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d taskmarketing.rsys.systems
```
After completing these steps, your web application will be fully live and functional on your company's server!
