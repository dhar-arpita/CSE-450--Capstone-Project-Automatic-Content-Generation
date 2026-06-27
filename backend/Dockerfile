# 1. Use the STABLE Bookworm release of Python 3.12
FROM python:3.12-slim-bookworm

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Install system dependencies required for pdf2image and weasyprint
# (Updated the libgdk package name)
RUN apt-get update && apt-get install -y \
    poppler-utils \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-xlib-2.0-0 \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

# 4. Copy only the requirements file first 
COPY requirements.txt .

# 5. Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# 6. Copy the rest of your backend code into the container
COPY . .

# 7. Expose the port FastAPI runs on
EXPOSE 8000

# 8. Command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]