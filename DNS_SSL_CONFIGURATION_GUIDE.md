# THE HIDDEN LABEL — DNS, SSL & REVERSE PROXY CONFIGURATION GUIDE

**Scope:** Domain DNS Routing, SSL/TLS Termination, and Safe Nginx Bootstrap  
**Author:** DevOps Reviewer & Security Engineer  

---

## 1. Required DNS Records Matrix

Configure the following DNS records with your registrar or DNS provider (Cloudflare, AWS Route 53, GoDaddy) pointing to your production server IP:

| Record Type | Hostname / Subdomain | Target / Value | TTL | Purpose |
|---|---|---|---|---|
| **A** | `@` (thehiddenlabel.com) | `<PRODUCTION_SERVER_IP>` | 300s | Primary Customer Storefront |
| **A** | `www` (www.thehiddenlabel.com) | `<PRODUCTION_SERVER_IP>` | 300s | Storefront CNAME / Alias |
| **A** | `admin` (admin.thehiddenlabel.com) | `<PRODUCTION_SERVER_IP>` | 300s | Operations & Admin Dashboard |
| **A** | `api` (api.thehiddenlabel.com) | `<PRODUCTION_SERVER_IP>` | 300s | Medusa 2.x Backend Engine & Webhooks |

*Note: Allow 5–15 minutes for global DNS propagation before executing ACME certificate validation.*

---

## 2. Server Port & Firewall Rules

On the production server (Ubuntu 24.04), configure UFW (Uncomplicated Firewall) to permit only essential ingress traffic:

```bash
# Default policies: block incoming, allow outgoing
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH management (use custom port if configured)
sudo ufw allow 22/tcp

# Allow Web Traffic (Nginx Reverse Proxy)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

**Internal Port Isolation:**
The following ports must **NEVER** be opened in UFW, as they are accessed exclusively through Docker's internal container network:
- Port `5432` (PostgreSQL)
- Port `6379` (Redis)
- Port `9000` (Backend API)
- Port `7001` (Admin Next.js)
- Port `3000` (Storefront Next.js)

---

## 3. Resolving the Nginx SSL Chicken-and-Egg Bootstrap

### A. The Dependency Conflict
In `deploy/nginx/conf.d/thehiddenlabel.conf`, SSL termination requires:
```nginx
ssl_certificate /etc/ssl/thehiddenlabel/fullchain.pem;
ssl_certificate_key /etc/ssl/thehiddenlabel/privkey.pem;
```
If Nginx starts before Certbot has run, these files do not exist. Nginx will crash on startup with `[emerg] cannot load certificate`, which prevents port 80 from serving the `/.well-known/acme-challenge/` path needed by Certbot.

### B. Safe Two-Stage Bootstrap Procedure

#### Stage 1: Generate Temporary Self-Signed Certificates
On the host server before starting the Nginx container, create the SSL directory and generate temporary dummy certificates:
```bash
mkdir -p deploy/ssl

openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
  -keyout deploy/ssl/privkey.pem \
  -out deploy/ssl/fullchain.pem \
  -subj "/CN=thehiddenlabel.com"
```

#### Stage 2: Start Nginx with Dummy Certificates
Now start Nginx; it will load the dummy certificate without crashing and begin listening on port 80:
```bash
docker compose -f docker-compose.prod.yml up -d reverse-proxy
```

#### Stage 3: Request Real Let's Encrypt Certificates via Certbot
Run Certbot in webroot mode using the mounted ACME volume:
```bash
sudo certbot certonly --webroot -w /var/www/certbot \
  -d thehiddenlabel.com \
  -d www.thehiddenlabel.com \
  -d admin.thehiddenlabel.com \
  -d api.thehiddenlabel.com \
  --email operations@thehiddenlabel.com \
  --agree-tos --no-eff-email
```

#### Stage 4: Replace Dummy Certificates with Real Certificates
Copy or symlink the genuine Let's Encrypt certificates into `deploy/ssl/`:
```bash
sudo cp /etc/letsencrypt/live/thehiddenlabel.com/fullchain.pem deploy/ssl/fullchain.pem
sudo cp /etc/letsencrypt/live/thehiddenlabel.com/privkey.pem deploy/ssl/privkey.pem
```

#### Stage 5: Reload Nginx Gracefully
Reload Nginx to switch from the temporary certificates to the trusted Let's Encrypt certificates without downtime:
```bash
docker compose -f docker-compose.prod.yml exec reverse-proxy nginx -s reload
```

---

## 4. Automated Certificate Renewal Protocol

Let's Encrypt certificates are valid for 90 days. Automate renewal using a systemd service or cron job:

### Cron Configuration
Open crontab (`sudo crontab -e`) and add:
```crontab
# Renew certificates at 03:00 AM on the 1st and 15th of every month
0 3 1,15 * * certbot renew --webroot -w /var/www/certbot --post-hook "cp /etc/letsencrypt/live/thehiddenlabel.com/*.pem /opt/the-hidden-label/deploy/ssl/ && docker compose -f /opt/the-hidden-label/docker-compose.prod.yml exec reverse-proxy nginx -s reload" >> /var/log/certbot-renew.log 2>&1
```

---

## 5. Verification Commands

Once live, verify SSL protocols and headers from any external terminal:

```bash
# 1. Verify HTTP to HTTPS Redirection
curl -I http://thehiddenlabel.com
# Expected: HTTP/1.1 301 Moved Permanently -> Location: https://thehiddenlabel.com/

# 2. Verify Storefront HTTPS & Security Headers
curl -I https://thehiddenlabel.com
# Expected:
#   HTTP/2 200
#   strict-transport-security: max-age=63072000; includeSubDomains; preload
#   x-content-type-options: nosniff
#   x-frame-options: SAMEORIGIN

# 3. Verify Admin Console Security Headers
curl -I https://admin.thehiddenlabel.com
# Expected:
#   x-frame-options: DENY
#   cross-origin-opener-policy: same-origin

# 4. Verify Backend Health Endpoint via HTTPS
curl -I https://api.thehiddenlabel.com/healthz
# Expected: HTTP/2 200 OK
```
