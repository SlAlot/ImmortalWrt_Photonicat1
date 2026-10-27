## SWRT · 光影猫一代 v1.9

适用于 **Photonicat 1 / RK3568**，支持 **1+8、2+16、4+64 GB** 机型，不适用于二代。

### 本次更新

- 首次开机按实际 eMMC 容量自动扩展根分区及文件系统，使用连续可用空间；已有额外数据分区保留，运行内存不变。
- 支持 SquashFS / F2FS 和 ext4，已完成扩容时不重复调整；内核需要重新读取分区时，会自动重启一次继续处理。
- 修复标准升级对已扩容根分区的识别，正常升级保留扩容后的分区边界。
- Docker 不设置容量配额或额外启动限制，保留已有自定义存储路径；全新 SquashFS 安装默认使用原生 `/overlay/docker`。

保留 QModem Next（Tom 核心）、网络面板、iStore、Docker / Compose、DiskMan、光影猫管理、在线更新国内加速，以及现有无线和 USB 驱动。软件与硬件流量卸载保持开启。

默认主机名 `S-Photonicat1`，网关 `192.168.17.1`，终端 Banner `SWRT`。

### 下载与更新

选择与当前系统相同类型的镜像，两个镜像选一个即可：

- `immortalwrt-photonicat-1-squashfs-sysupgrade-1.9.img.gz`
- `immortalwrt-photonicat-1-ext4-sysupgrade-1.9.img.gz`
- `sha256sums`：文件完整性校验清单。

**已安装 SWRT：**先下载配置备份，再使用“系统 → SWRT 在线更新”，或在“系统 → 备份与升级”直接上传 `.img.gz`。推荐不保留配置，更新后重新设置。Docker 镜像、容器、数据卷和其他重要文件需要另行备份，配置备份不包含这些数据；保留分区边界也不等于保留分区内全部文件。

**首次安装或从其他系统切换：**使用 RKDevTool USB 线刷，**先将 `.img.gz` 解压成 `.img`**，使用一代 Loader，完整镜像写入地址为 `0x00000000`。不要将压缩包直接刷入，也不要下载 GitHub 的 “Source code” 当固件。

首次开机自动扩容，可能额外重启一次，请保持供电并等待管理页恢复。步骤见[项目 README](https://github.com/SlAlot/ImmortalWrt_Photonicat1#下载与安装)。

### 验证范围

扩容在隔离 Linux 环境使用实际文件系统验证，覆盖 8 / 16 / 64 GiB、真机 64GB 容量、非整 MiB 容量、F2FS / ext4、重复执行、额外数据分区及重启续跑，并检查配置、UUID、启动代码与 Loader 内容保留。完整构建、软件包清单和镜像检查由本次 Actions 执行。

这些结果不等于每种容量机型均已刷机实测，也不代表全部 iStore 容器应用都已验证。排查记录见[存储说明](https://github.com/SlAlot/ImmortalWrt_Photonicat1/blob/main/docs/STORAGE-RECOVERY.md)。
