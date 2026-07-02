# Back to python after so much of Typescript :)

from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from pydantic import BaseModel
import cv2 
import numpy as np
from PIL import Image
import io
import torch
from transformers import CLIPProcessor, ViTImageProcessor
from insightface.app import FaceAnalysis
import os
import asyncio
import torchvision.transforms.functional as TF
import psutil

cores_c = min(4, os.cpu_count() or 4)
torch.set_num_threads(cores_c)


app = FastAPI(title="Lumi")
print("loading ai")

device = "cuda" if torch.cuda.is_available() else "cpu"
gpu_name = None
vram_gb = None
ram_gb = round(psutil.virtual_memory().total / 1e9, 1)

if device == "cuda":
    gpu_name = torch.cuda.get_device_name(0)
    vram_gb = round(torch.cuda.get_device_properties(0).total_mem / 1e9, 1)
    print(f"Using CUDA - {gpu_name} ({vram_gb} GB VRAM)")
else: 
    print(f"Using CPY - {ram_gb} GB RAM")

if device == "cuda" and vram_gb and vram_gb >= 6:
    clip_model_name = "openai/clip-vit-large-patch14"
    face_mode_name = "buffalo_l"
    print("using large models")
elif device == "cuda":
    clip_model_name = "openai/clip-vit-base-patch16"
    face_model_name = "buffalo_sc"
    print("using base models")
else:
    clip_model_name = "openai/clip-vit-base-patch16"
    face_model_name = "buffalo_sc"
    print("using base models with ONNX")

clip_processor = CLIPProcessor.from_pretrained(clip_model_name)

if device == "cuda":
    from transformers import CLIPModel, ViTForImageClassification
    clip_model = CLIPModel.from_pretrained(clip_model_name).to(device)
    vit_processor = ViTImageProcessor.from_pretrained('google/vit-base-patch16-224')
    vit_model = ViTForImageClassification.from_pretrained('google/vit-base-patch16-224').to(device)
    vit_loaded = True
else:
    from transformers import CLIPModel
    if ram_gb >= 4:
        from optimum.onnxruntime import ORTModelForFeatureExtraction, ORTModelForImageClassification
        clip_model = CLIPModel.from_pretrained(clip_model_name)
        vit_processor = ViTImageProcessor.from_pretrained('google/vit-base-patch16-224')
        vit_model = ORTModelForImageClassification.from_pretrained("google/vit-base-patch16-224", export=True)
        vit_loaded = True
    else:
        clip_model = CLIPModel.from_pretrained(clip_model_name)
        vit_loaded = False
        vit_processor = None
        vit_model = None
        print("low ram , skipping vit tagging model")

with torch.inference_mode():
    dummy = clip_processor(text=["test"], return_tensors="pt", padding=True)
    dummy_out = clip_model.get_text_features(**dummy.to(device) if device == "cuda" else dummy)
    clip_embedding_dim = dummy_out.shape[-1]
    print(f"clip embedding dim: {clip_embedding_dim}")

onnx_providers = ['CUDAExecutionProvider'] if device == "cuda" else ['CPUExecutionProvider']
face_analysis = FaceAnalysis(name=face_model_name, root='.', providers=onnx_providers)
face_analysis.prepare(ctx_id=0, det_size=(640, 640))

ocr_loaded = False
reader = None
if ram_gb >= 4 or device == "cuda":
    import easyocr
    reader = easyocr.Reader(['en'], gpu=(device == "cuda"))
    ocr_loaded = True
else:
    print("low ram, skipping ocr")

nima_available = False
nima_metric = None
try:
    if ram_gb >= 4 or device == "cuda":
        import pyiqa
        nima_metric = pyiqa.create_metric('nima', device=device)
        nima_available = True
except Exception as e:
    print(f"NIMA model failed to load: {e}")

print("ai models loaded")

def calc_aesthetic_score(pil_image: Image.Image) -> float:
    img_tensor = TF.to_tensor(pil_image).unsqueeze(0).to(device)
    with torch.inference_mode():
        raw_score = nima_metric(img_tensor).item()
    normalized = max(0.0, min(100.0, (raw_score - 1.0) * (100.0 / 9.0)))
    return round(normalized, 2)

def get_toggle(request: Request, header: str, default: bool) -> bool:
    val = request.headers.get(header)
    if val is None:
        return default
    return val.lower() == "true"

class TextRequest(BaseModel):
    text: str

@app.get("/health")
def hl_check():
    return {"status": "online"}

@app.get("/info")
def get_info():
    return {
        "device": device,
        "gpu_name": gpu_name,
        "vram_gb": vram_gb,
        "ram_gb": ram_gb,
        "clip_embedding_dim": clip_embedding_dim,
        "models": {
            "clip": clip_model_name,
            "face": face_model_name,
            "vit": vit_loaded,
            "ocr": ocr_loaded,
            "nima": nima_available,
        }
    }

@app.post("/encode/text")
def encode_text(req: TextRequest):
    try:
        inputs = clip_processor(text=[req.text], return_tensors="pt", padding=True).to(device)
        with torch.inference_mode():
            text_features = clip_model.get_text_features(**inputs)
            text_features = text_features / text_features.norm(p=2, dim=-1, keepdim=True)  

        return {"embedding": text_features[0].cpu().numpy().tolist()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/image")
async def analyze_image(request: Request, file: UploadFile = File(...)):
    try:
        enable_clip = get_toggle(request, "x-enable-clip", True)
        enable_faces = get_toggle(request, "x-enable-faces", True)
        enable_ocr = get_toggle(request, "x-enable-ocr", True)
        enable_nima = get_toggle(request, "x-enable-nima", True)
        enable_tags = get_toggle(request, "x-enable-tags", True)
        face_confidence = float(request.headers.get("x-face-confidence", "0.85"))

        image_bytes = await file.read()
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
        blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()

        def extract_faces():
            if not enable_faces:
                return[]
            faces_data = []
            detected_faces = face_analysis.get(cv_image)

            for face in detected_faces:
                if face.det_score > face_confidence:
                    x1, y1, x2, y2 = face.bbox
                    embedding = face.normed_embedding if hasattr(face, "normed_embedding") else face.embedding

                    faces_data.append({
                        "boundingBox": {"x": float(x1), "y": float(y1), "w": float(x2 - x1), "h": float(y2 - y1)},
                        "embedding": embedding.tolist()
                    })
            return faces_data
        
        def extract_ocr():
            if not enable_ocr or not ocr_loaded or reader is None:
                return ""
            max_ocr_sz = 640
            h, w = cv_image.shape[:2]
            if max(h, w) > max_ocr_sz:
                scale = max_ocr_sz / max(h, w)
                ocr_img = cv2.resize(cv_image, (int(w * scale), int(h * scale)))
            else:
                ocr_img = cv_image
            ocr_results = reader.readtext(ocr_img, detail=0, contrast_ths=0.1, paragraph=True)
            return " ".join(ocr_results)

        faces_task = asyncio.to_thread(extract_faces)
        ocr_task = asyncio.to_thread(extract_ocr)

        nima_task = None
        if enable_nima and nima_available:
            nima_task = asyncio.to_thread(calc_aesthetic_score, pil_image)

        clip_embedding = None
        if enable_clip:
            clip_inputs = clip_processor(images=pil_image, return_tensors="pt").to(device)
            with torch.inference_mode():
                image_features = clip_model.get_image_features(**clip_inputs)
                image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True) 
            clip_embedding = image_features[0].cpu().numpy().tolist()

        tags = []
        if enable_tags and vit_loaded and vit_processor and vit_model:
            vit_inputs = vit_processor(images=pil_image, return_tensors="pt")
            if device == "cuda":
                vit_inputs = vit_inputs.to(device)
                with torch.inference_mode():
                    vit_outputs = vit_model(**vit_inputs)
                    logits = vit_outputs.logits
            else:
                vit_outputs = vit_model(**vit_inputs)
                logits = vit_outputs.logits
            probs = logits.softmax(dim=-1)[0]
            top_probs, top_indices = probs.topk(5)
            for p, idx in zip(top_probs, top_indices):
                if p.item() > 0.1:
                    label = vit_model.config.id2label[idx.item()].split(",")[0].lower()
                    tags.append(label)

        faces_data = await faces_task
        extracted_text = await ocr_task
        aesthetic_score = None
        if nima_task is not None:
            try:
                aesthetic_score = await nima_task
            except Exception as e:
                print(f"nima scoring failed: {e}")
        
        return {
            "blurScore": float(blur_score),
            "clipEmbedding": clip_embedding,
            "tags": list(set(tags)),
            "faces": faces_data,
            "extractedText": extracted_text,
            "aestheticScore": aesthetic_score
        }
    except Exception as e:
        print(f"analysis failed {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/score/aesthetic")
async def score_aesthetic(file: UploadFile = File(...)):
    if not nima_available:
        raise HTTPException(status_code=503, detail="NIMA model not available")
    
    try:
        image_bytes = await file.read()
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        score = await asyncio.to_thread(calc_aesthetic_score, pil_image)
        return {"aestheticScore": score}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))