from io import BytesIO

from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError


MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_FORMATS = frozenset({'JPEG', 'PNG', 'WEBP'})


def validate_image_upload(uploaded_file):
    if uploaded_file.size > MAX_IMAGE_UPLOAD_BYTES:
        raise ValidationError('La imagen no puede superar los 5 MB.')

    try:
        image = Image.open(uploaded_file)
        image.verify()
        image_format = image.format
    except (UnidentifiedImageError, OSError):
        raise ValidationError('El archivo no es una imagen válida.')
    finally:
        uploaded_file.seek(0)

    if image_format not in ALLOWED_IMAGE_FORMATS:
        raise ValidationError('Solo se permiten imágenes JPG, PNG o WebP.')

    try:
        Image.open(BytesIO(uploaded_file.read())).load()
    except (UnidentifiedImageError, OSError):
        raise ValidationError('La imagen no se pudo leer correctamente.')
    finally:
        uploaded_file.seek(0)
