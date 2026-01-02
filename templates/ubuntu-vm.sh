#!/bin/bash

# Template for Ubuntu VM with QEMU and Nix
# Variables available: {{HOSTNAME}}, {{TAILSCALE_KEY}}, {{USER_DATA}}, {{SECRET_PASSWORD}}

echo "Checking qemu-kvm..."
nix-shell -p qemu_kvm --run "qemu-kvm --version" || { echo "Error running qemu-kvm via nix-shell. Exiting..."; exit 1; }

echo "Stopping running VMs..."
ps -eo pid,comm,args | grep '[q]emu-system' | awk '{print $1}' | xargs -r kill -9
killall adb 2>/dev/null || pkill -f adb

echo "Starting cleanup of /home..."
KEEP1="/home/user/myapp/.idx/dev.nix"
KEEP2="/home/check.ok"
KEEP3="/home/run_vm.sh"

if [ ! -f "$KEEP2" ]; then
  echo "$KEEP2 does not exist. Proceeding to clean /home..."
  [ -f "$KEEP1" ] && cp "$KEEP1" /tmp/dev.nix.backup
  [ -f "$KEEP3" ] && cp "$KEEP3" /tmp/run_vm.sh.backup
  find /home -mindepth 1 -path "$(dirname "$KEEP1")" -prune -o -path "$KEEP3" -prune -o -exec rm -rf {} +
  [ -f /tmp/dev.nix.backup ] && mkdir -p "$(dirname "$KEEP1")" && cp /tmp/dev.nix.backup "$KEEP1"
  [ -f /tmp/run_vm.sh.backup ] && cp /tmp/run_vm.sh.backup "$KEEP3" && chmod +x "$KEEP3"
  touch "$KEEP2"
else
  echo "$KEEP2 already exists. Skipping cleanup."
fi

echo "Installing necessary packages..."
nix-env -iA nixpkgs.unzip nixpkgs.python3 nixpkgs.git nixpkgs.axel nixpkgs.curl nixpkgs.lsb-release nixpkgs.gnupg nixpkgs.gzip

if [ ! -f "noble-server-cloudimg-amd64.img" ]; then
  echo "Downloading base image..."
  wget https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img
else
  echo "Found base image."
fi

raw_path=$(realpath "noble-server-cloudimg-amd64.img")
qemu-img resize "$raw_path" 46G

echo "Downloading OVMF.fd..."
curl -L -o OVMF.fd https://github.com/clearlinux/common/raw/refs/heads/master/OVMF.fd
chmod 644 ./OVMF.fd

# Tạo user-data (Injected from JSON)
cat > user-data <<EOF
{{USER_DATA}}
EOF

# Tạo meta-data
if [ ! -f "seed.img" ]; then
  echo "Creating meta-data for {{HOSTNAME}}"
  cat > meta-data <<EOF
instance-id: id-{{HOSTNAME}}
local-hostname: {{HOSTNAME}}
EOF
  nix-shell -p cloud-utils --run 'cloud-localds seed.img user-data meta-data'
fi

echo "Setting up Tailscale..."
DECRYPTED_STRING="{{TAILSCALE_KEY}}"
SECRET_PASSWORD="{{SECRET_PASSWORD}}"

NEW_KEY=$(echo "${DECRYPTED_STRING}" | openssl enc -aes-256-cbc -d -base64 -pbkdf2 -pass pass:"${SECRET_PASSWORD}")

# ... (Rest of your tailscale and SSH logic) ...

# Final VM Execution
nix-shell -p qemu_kvm -p python3 -p git -p novnc --run '
./noVNC/utils/novnc_proxy --vnc localhost:5900 --listen 0.0.0.0:8080 &

nohup qemu-kvm \
  -cpu host,+topoext,hv_relaxed,hv_spinlocks=0x1fff,hv-passthrough,+pae,+nx,kvm=on,+svm \
  -smp 8,cores=8 \
  -m 30G \
  -enable-kvm \
  -hda noble-server-cloudimg-amd64.img \
  -drive if=pflash,format=raw,readonly=off,file=./OVMF.fd \
  -drive file=./seed.img,format=raw,if=virtio \
  -vnc :0 > /dev/null 2>&1
'
