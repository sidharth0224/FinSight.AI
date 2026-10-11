#!/usr/bin/env bash
set -Eeuo pipefail
case "$(uname -m)" in aarch64|x86_64) ;; *) echo 'Ubuntu ARM64 or AMD64 is required.' >&2; exit 1;; esac
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg snapd
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
task_arch="$(dpkg --print-architecture)"
task_codename="$(. /etc/os-release && echo "$VERSION_CODENAME")"
echo "deb [arch=$task_arch signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $task_codename stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
sudo snap install --classic certbot
echo 'Reconnect your SSH session for Docker group access. Optional swap: follow docs/EC2_DEPLOYMENT.md.'
