import os
import sys
from PIL import Image

OFFICIAL_APP_LOGO = r"z:\Novaura platform\Official Novaura LOGO.png"
AURAXNOVA_INSTALLER_LOGO = r"z:\Novaura platform\Aura x Nova operating systems logo.jpg"

TAURI_ICONS_DIR = r"z:\Novaura platform\novaura OS soveriegn\src-tauri\icons"
PUBLIC_DIR = r"z:\Novaura platform\novaura OS soveriegn\public"
SRC_ASSETS_DIR = r"z:\Novaura platform\novaura OS soveriegn\src\assets"

def generate_app_and_installer_icons():
    print("=" * 68)
    print("      NOVAURA SOVEREIGN OS — ICON ENGINE")
    print("=" * 68)

    os.makedirs(TAURI_ICONS_DIR, exist_ok=True)
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    os.makedirs(SRC_ASSETS_DIR, exist_ok=True)

    # -------------------------------------------------------------
    # 1. ACTUAL APPLICATION ICONS: Official Novaura Logo (Rainbow/N)
    # -------------------------------------------------------------
    print(f"\n[1] Processing Actual App Icon: {OFFICIAL_APP_LOGO}")
    app_img = Image.open(OFFICIAL_APP_LOGO)
    if app_img.mode != 'RGBA':
        app_img = app_img.convert('RGBA')

    # Multi-resolution Windows ICO for app.exe, shortcuts, taskbar
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    app_ico_path = os.path.join(TAURI_ICONS_DIR, "icon.ico")
    app_img.save(app_ico_path, format="ICO", sizes=ico_sizes)
    print(f"    [+] Saved app multi-resolution ICO: {app_ico_path}")

    # Master app PNG
    app_png_path = os.path.join(TAURI_ICONS_DIR, "icon.png")
    app_img.resize((512, 512), Image.Resampling.LANCZOS).save(app_png_path, format="PNG")
    print(f"    [+] Saved app master PNG (512x512): {app_png_path}")

    # Standard sizes
    for size in [32, 64, 128]:
        p = os.path.join(TAURI_ICONS_DIR, f"{size}x{size}.png")
        app_img.resize((size, size), Image.Resampling.LANCZOS).save(p, format="PNG")
        print(f"    [+] Generated {size}x{size}.png")

    p2x = os.path.join(TAURI_ICONS_DIR, "128x128@2x.png")
    app_img.resize((256, 256), Image.Resampling.LANCZOS).save(p2x, format="PNG")
    print(f"    [+] Generated 128x128@2x.png (256x256)")

    for sq in [30, 44, 71, 89, 107, 142, 150, 284, 310]:
        p = os.path.join(TAURI_ICONS_DIR, f"Square{sq}x{sq}Logo.png")
        app_img.resize((sq, sq), Image.Resampling.LANCZOS).save(p, format="PNG")

    store_p = os.path.join(TAURI_ICONS_DIR, "StoreLogo.png")
    app_img.resize((50, 50), Image.Resampling.LANCZOS).save(store_p, format="PNG")

    # Update web public favicons
    fav_ico = os.path.join(PUBLIC_DIR, "favicon.ico")
    app_img.save(fav_ico, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    fav_png = os.path.join(PUBLIC_DIR, "favicon.png")
    app_img.resize((128, 128), Image.Resampling.LANCZOS).save(fav_png, format="PNG")
    print(f"    [+] Updated public favicons (favicon.ico, favicon.png)")

    # Update src/assets/novaura-logo.png
    src_logo = os.path.join(SRC_ASSETS_DIR, "novaura-logo.png")
    app_img.save(src_logo, format="PNG")
    print(f"    [+] Verified src/assets/novaura-logo.png")

    # -------------------------------------------------------------
    # 2. INSTALLER ICONS & ARTWORK: Aura x Nova Operating Systems Logo
    # -------------------------------------------------------------
    print(f"\n[2] Processing Installer Artwork: {AURAXNOVA_INSTALLER_LOGO}")
    inst_img = Image.open(AURAXNOVA_INSTALLER_LOGO)
    if inst_img.mode != 'RGB':
        inst_img = inst_img.convert('RGB')

    # Installer standalone .ico (Aura x Nova cosmic tree)
    inst_ico_path = os.path.join(TAURI_ICONS_DIR, "installer.ico")
    inst_img.save(inst_ico_path, format="ICO", sizes=ico_sizes)
    print(f"    [+] Saved installer.ico: {inst_ico_path} ({os.path.getsize(inst_ico_path)} bytes)")

    inst_png_path = os.path.join(TAURI_ICONS_DIR, "installer.png")
    inst_img.resize((512, 512), Image.Resampling.LANCZOS).save(inst_png_path, format="PNG")
    print(f"    [+] Saved installer.png: {inst_png_path}")

    # NSIS Header BMP: 150 x 57
    header_bmp_path = os.path.join(TAURI_ICONS_DIR, "installer-header.bmp")
    # Thumbnail/crop to fit nicely
    header_img = inst_img.resize((150, 57), Image.Resampling.LANCZOS)
    header_img.save(header_bmp_path, format="BMP")
    print(f"    [+] Saved NSIS header BMP (150x57): {header_bmp_path}")

    # NSIS Sidebar BMP: 164 x 314
    sidebar_bmp_path = os.path.join(TAURI_ICONS_DIR, "installer-sidebar.bmp")
    sidebar_img = inst_img.resize((164, 314), Image.Resampling.LANCZOS)
    sidebar_img.save(sidebar_bmp_path, format="BMP")
    print(f"    [+] Saved NSIS sidebar BMP (164x314): {sidebar_bmp_path}")

    print("\n" + "=" * 68)
    print("All App and Installer icons generated successfully.")
    print("=" * 68)

if __name__ == "__main__":
    generate_app_and_installer_icons()
