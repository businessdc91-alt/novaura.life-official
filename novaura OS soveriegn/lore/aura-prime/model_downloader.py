
import os
import sys
import argparse
from huggingface_hub import snapshot_download

# Define model repositories
MODELS = {
    "image": "runwayml/stable-diffusion-v1-5",
    "audio": "cvssp/audioldm-m-full",
    "video": "damo-vilab/modelscope-damo-text-to-video-hd"
}

def download_model(model_type, base_path):
    repo_id = MODELS.get(model_type)
    if not repo_id:
        print(f"[ERROR]: Unknown model type: {model_type}")
        return False
    
    target_dir = os.path.join(base_path, model_type)
    os.makedirs(target_dir, exist_ok=True)
    
    print(f"[DOWNLOADING]: {model_type} -> {repo_id}")
    try:
        snapshot_download(
            repo_id=repo_id,
            local_dir=target_dir,
            local_dir_use_symlinks=False,
            resume_download=True
        )
        print(f"[SUCCESS]: {model_type} model ready at {target_dir}")
        return True
    except Exception as e:
        print(f"[CRITICAL FAILURE]: Failed to download {model_type}: {e}")
        return False

def check_models(base_path):
    status = {}
    for m_type, repo_id in MODELS.items():
        m_path = os.path.join(base_path, m_type)
        exists = os.path.exists(m_path) and any(os.scandir(m_path))
        status[m_type] = "ONLINE" if exists else "MISSING"
    return status

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Aura Nova Model Downloader")
    parser.add_argument("--type", type=str, help="Model type to download (image, audio, video, all)")
    parser.add_argument("--path", type=str, default="e:/AuraxNova_Command_v5/Models", help="Base path for models")
    parser.add_argument("--check", action="store_true", help="Check status of all models")
    
    args = parser.parse_args()
    
    if args.check:
        results = check_models(args.path)
        for m, s in results.items():
            print(f"{m.upper()}: {s}")
        sys.exit(0)
        
    if args.type == "all":
        for t in MODELS.keys():
            download_model(t, args.path)
    elif args.type:
        download_model(args.type, args.path)
    else:
        parser.print_help()
