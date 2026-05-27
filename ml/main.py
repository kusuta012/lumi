# Back to python after so much of Typescript :)

from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
import cv2 
import numpy as np
import requests
from PIL import Image
import io
import torch
from transformers import CLIPProcessor, CLIPModel, ViTImageProcessor, ViTForImageClassification
from insightface.app import FaceAnalysis
import easyocr


app = FastAPI(title="Lumi")
print("loading ai")
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using {device.upper()}")

clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch16").to(device)
clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch16")

vit_processor = ViTImageProcessor.from_pretrained('google/vit-base-patch16-224')
vit_model = ViTForImageClassification.from_pretrained('google/vit-base-patch16-224').to(device)

face_analysis = FaceAnalysis(name='buffalo_sc', root='.', provider=['CPUExecutionProvider'])
face_analysis.prepare(ctx_id=0, det_size=(640, 640))

reader = easyocr.Reader(['en'], gpu=torch.cuda.is_available())

print("ai models loaded")

class TextRequest(BaseModel):
    text: str

@app.get("/health")
def hl_check():
    return {"status": "online"}

@app.post("/encode/text")
def encode_text(req: TextRequest):
    try:
        inputs = clip_processor(text=[req.text], return_tensors="pt", padding=True).to(device)
        with torch.no_grad():
            text_outputs = clip_model.get_text_features(**inputs)
            pooled_output = text_outputs.pooler_output

            if pooled_output.shape[-1] == 512:
                text_features = pooled_output
            else:
                text_features = clip_model.text_projection(pooled_output)

            text_features = text_features / text_features.norm(p=2, dim=-1, keepdim=True)

        return {"embedding": text_features[0].cpu().numpy().tolist()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/image")
async def analyze_image(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
        blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()

        clip_inputs = clip_processor(images=pil_image, return_tensors="pt").to(device)
        with torch.no_grad():
            vision_outputs = clip_model.get_image_features(**clip_inputs)
            pooled_output = vision_outputs.pooler_output

            if pooled_output.shape[-1] == 512:
                image_features = pooled_output
            else:
                image_features = clip_model.visual_projection(pooled_output)

            image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)
        
        clip_embedding = image_features[0].cpu().numpy().tolist()

        vit_inputs = vit_processor(images=pil_image, return_tensors="pt").to(device)
        with torch.no_grad():
            vit_outputs = vit_model(**vit_inputs)
        logits = vit_outputs.logits
        probs = logits.softmax(dim=-1)[0]
        top_probs, top_indices = probs.topk(5)
        tags = []
        for p, idx in zip(top_probs, top_indices):
            if p.item() > 0.1:
                label = vit_model.config.id2label[idx.item()].split(",")[0].lower()
                tags.append(label)


        faces_data = []
        detected_faces = face_analysis.get(cv_image)

        for face in detected_faces:
            if face.det_score > 0.60:
                x1, y1, x2, y2 = face.bbox
                embedding = face.normed_embedding if hasattr(face, "normed_embedding") else face.embedding

                faces_data.append({
                    "boundingBox": {"x": float(x1), "y": float(y1), "w": float(x2 - x1), "h": float(y2 - y1)},
                    "embedding": embedding.tolist()
                })
        
        max_ocr_sz = 640
        h, w = cv_image.shape[:2]
        if max(h, w) > max_ocr_sz:
            scale = max_ocr_sz / max(h, w)
            ocr_img = cv2.resize(cv_image, (int(w * scale), int(h * scale)))
        else:
            ocr_img = cv_image

        ocr_results = reader.readtext(ocr_img, detail=0, contrast_ths=0.1, paragraph=True)
        extracted_text = " ".join(ocr_results)

        return {
            "blurScore": float(blur_score),
            "clipEmbedding": clip_embedding,
            "tags": list(set(tags)),
            "faces": faces_data,
            "extractedText": extracted_text
        }
    except Exception as e:
        print(f"analysis failed {e}")
        raise HTTPException(status_code=500, detail=str(e))
