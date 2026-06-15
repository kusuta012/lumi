FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
RUN pip install -r requirements.txt

COPY . .

RUN python -c "import pyiqa; pyiqa.create_metric('nima', device='cpu')"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]