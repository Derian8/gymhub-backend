FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    libfreetype6-dev \
    libpng-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ --no-cache-dir

COPY . .

RUN mkdir -p /app/media/charts

EXPOSE 8000

CMD ["gunicorn", "gymhub.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "120", "--reload"]
