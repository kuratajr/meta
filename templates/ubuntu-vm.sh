#!/bin/bash

# Template for Ubuntu VM with QEMU and Nix

export VM_NAME="{{VM_NAME}}"
export VCPUS="{{VCPUS}}"
export CORES="{{CORES}}"
export MEMORY="{{MEMORY}}"
export OS_VARIANT="{{OS_VARIANT}}"                        # Dùng: osinfo-query os để xem list
export LIST_PORT="{{LIST_PORT}}"

nix-shell -p libuuid --run 'export VM_UUID="{{UUID}}"'
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
nix-env -iA nixpkgs.unzip nixpkgs.python3 nixpkgs.git nixpkgs.axel nixpkgs.curl nixpkgs.lsb-release nixpkgs.gnupg nixpkgs.gzip nixpkgs.libvirt nixpkgs.virt-manager nixpkgs.libuuid


# 1. Xóa các file cấu hình tạm nếu tồn tại
echo "--- Đang kiểm tra và dọn dẹp file cấu hình tạm ---"
for file in meta-data user-data seed.img debian-13.qcow2; do
    if [ -f "$file" ]; then
        rm -v "$file"
    fi
done

# 2. Xử lý file Ubuntu 24 (noble)
SOURCE_UBUNTU="noble-server-cloudimg-amd64.img"
DEST_UBUNTU_DIR="/home/os/ubuntu"
DEST_UBUNTU_FILE="$DEST_UBUNTU_DIR/ubuntu24.img"

if [ -f "$SOURCE_UBUNTU" ]; then
    echo "--- Đang xử lý file Ubuntu ---"
    # Tạo thư mục nếu chưa có (-p giúp tạo cả cây thư mục)
    mkdir -p "$DEST_UBUNTU_DIR"
    # Di chuyển và đổi tên
    mv -v "$SOURCE_UBUNTU" "$DEST_UBUNTU_FILE"
fi

# 3. Xử lý file Windows 2022
SOURCE_WIN="windows2022.raw"
DEST_WIN_DIR="/home/os/windows"
DEST_WIN_FILE="$DEST_WIN_DIR/windows2022.raw"

if [ -f "$SOURCE_WIN" ]; then
    echo "--- Đang xử lý file Windows ---"
    # Tạo thư mục nếu chưa có
    mkdir -p "$DEST_WIN_DIR"
    # Di chuyển
    mv -v "$SOURCE_WIN" "$DEST_WIN_FILE"
fi

echo "--- Hoàn tất xử lý ---"

# Định nghĩa biến
export MASTER_API_KEY="{{P_KEY}}"

# --- PHẦN XỬ LÝ ĐƯỜNG DẪN OS ---
OS_DIR="/home/os/{{OS_NAME}}"
IMAGE_NAME="{{OS_VERSION}}"
export FULL_PATH="$OS_DIR/$IMAGE_NAME"

mkdir -p "$OS_DIR"


if [ ! -f "$FULL_PATH" ]; then
  echo "Không tìm thấy ảnh của $OS_NAME tại $FULL_PATH. Đang tải bản OS mặc định..."
  wget {{OS_URL}} -O "$FULL_PATH"
else
  echo "Đã tìm thấy ảnh của $OS_NAME tại: $FULL_PATH"
fi

echo "Đang thay đổi kích thước ảnh tại $FULL_PATH..."
qemu-img resize "$FULL_PATH" {{OS_SIZE}}

export CLOUD_INIT_PATH="{{CLOUD_INIT_PATH}}"

mkdir -p "$CLOUD_INIT_PATH"

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
# --- 4. Kiểm tra và tải vm-api ---
API_DIR="/home/os/script"
API_FILE="$API_DIR/vm-api"


mkdir -p "$API_DIR"
wget {{API_URL}} -O "$API_FILE"
chmod +x "$API_FILE"

nohup "$API_FILE" > vm-api.log 2>&1 &

nix-shell -p qemu_kvm -p python3 -p git -p libvirt -p virt-manager -p libuuid --run '

VMS=$(virsh --connect qemu:///session list --all --name)

for VM in $VMS; do
    if [ -n "$VM" ]; then
        echo "Processing VM: $VM..."
        # Tắt máy ảo nếu đang chạy
        virsh --connect qemu:///session destroy "$VM" 2>/dev/null || true
        # Xóa định nghĩa máy ảo khỏi hệ thống
        virsh --connect qemu:///session undefine "$VM" 2>/dev/null || true
    fi
done

echo "All VMs in qemu:///session have been removed."

qemu-img resize --shrink "$FULL_PATH" "{{OS_SIZE}}"

{{OS_TEMPLATE}}

echo "VM started in the background."

'