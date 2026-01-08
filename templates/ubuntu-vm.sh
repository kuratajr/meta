#!/bin/bash

# Template for Ubuntu VM with QEMU and Nix

VM_NAME="{{VM_NAME}}"
VCPUS="{{VCPUS}}"
CORES="{{CORES}}"
MEMORY="{{MEMORY}}"
OS_VARIANT="{{OS_VARIANT}}"                        # Dùng: osinfo-query os để xem list
VM_UUID="{{UUID}}"
LIST_PORT="{{LIST_PORT}}"

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


# Định nghĩa biến
export MASTER_API_KEY="{{P_KEY}}"

# --- PHẦN XỬ LÝ ĐƯỜNG DẪN OS ---
OS_DIR="/home/os/{{OS_NAME}}"
IMAGE_NAME="{{OS_VERSION}}"
FULL_PATH="$OS_DIR/$IMAGE_NAME"

mkdir -p "$OS_DIR"


if [ ! -f "$FULL_PATH" ]; then
  echo "Không tìm thấy ảnh của $OS_NAME tại $FULL_PATH. Đang tải bản OS mặc định..."
  wget {{OS_URL}} -O "$FULL_PATH"
else
  echo "Đã tìm thấy ảnh của $OS_NAME tại: $FULL_PATH"
fi

echo "Đang thay đổi kích thước ảnh tại $FULL_PATH..."
qemu-img resize "$FULL_PATH" {{OS_SIZE}}

CLOUD_INIT_PATH="{{CLOUD_INIT_PATH}}"

echo "Đang tải OVMF vào {{OVMF_PATH}}..."
curl -L -o "$CLOUD_INIT_PATH/OVMF.fd" https://github.com/clearlinux/common/raw/refs/heads/master/OVMF.fd
chmod 644 "$CLOUD_INIT_PATH/OVMF.fd"



FILES_TO_CLEAN=("$CLOUD_INIT_PATH/user-data" "$CLOUD_INIT_PATH/meta-data" "$CLOUD_INIT_PATH/seed.img")

echo "Cleaning up old configuration files..."
for file in "${FILES_TO_CLEAN[@]}"; do
  if [ -f "$file" ]; then
    rm "$file"
    echo "Deleted: $file"
  fi
done


# Tạo user-data (Injected from JSON)
cat > "$CLOUD_INIT_PATH/user-data" <<EOF
{{USER_DATA}}
EOF

echo "Creating meta-data with hostname: $WORKSPACE_SLUG"
cat > "$CLOUD_INIT_PATH/meta-data" <<EOF
{{META_DATA}}
EOF

# Tạo seed.img  cloud-localds
nix-shell -p cloud-utils --run "cloud-localds \"$CLOUD_INIT_PATH/seed.img\" \"$CLOUD_INIT_PATH/user-data\" \"$CLOUD_INIT_PATH/meta-data\""


echo "Done! All files have been refreshed."

echo "========================================="
echo "              SUCCESS!"
echo "========================================="

echo "script by fb.com/thoai.ngoxuan" >> /home/user/myapp/readme.txt
echo "GZ by kuratajr" >> /home/user/myapp/readme.txt
echo "Init latest" >> /home/user/myapp/readme.txt

echo "Starting VM and noVNC..."
pkill -f novnc_proxy
pkill -f vm-api

# 1. Quản lý noVNC
if [ ! -d 'noVNC' ]; then
  git clone https://github.com/novnc/noVNC.git
fi
ln -sf vnc.html ./noVNC/emulator.html
ln -sf vnc.html ./noVNC/index.html

# 2. Khởi chạy các dịch vụ nền bằng nohup
echo 'Starting noVNC proxy...'
nohup ./noVNC/utils/novnc_proxy --vnc localhost:{{VNC_PORT}} --listen 0.0.0.0:{{PU_VNC_PORT}} > novnc.log 2>&1 &

echo 'Starting VM-API...'
# Đảm bảo file có quyền thực thi
chmod +x /home/os/script/vm-api
nohup /home/os/script/vm-api > vm-api.log 2>&1 &

qemu-img resize --shrink "$FULL_PATH" "{{OS_SIZE}}"

virsh --connect qemu:///session destroy "$VM_NAME" 2>/dev/null || true
virsh --connect qemu:///session undefine "$VM_NAME" 2>/dev/null || true

{{OS_TEMPLATE}}

echo "VM started in the background."