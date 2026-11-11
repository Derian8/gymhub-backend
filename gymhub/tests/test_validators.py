"""
test_validators.py — Tests de validadores de modelos (Exercise fields).
"""
import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from io import BytesIO


def _image_upload(name='image.png', image_format='PNG', size=(10, 10)):
    buffer = BytesIO()
    Image.new('RGB', size, color='white').save(buffer, format=image_format)
    return SimpleUploadedFile(
        name,
        buffer.getvalue(),
        content_type=f'image/{image_format.lower()}',
    )


def test_image_upload_accepts_supported_format():
    from users.validators import validate_image_upload

    validate_image_upload(_image_upload())


def test_image_upload_rejects_oversized_file():
    from users.validators import MAX_IMAGE_UPLOAD_BYTES, validate_image_upload

    upload = SimpleUploadedFile(
        'large.png',
        b'x' * (MAX_IMAGE_UPLOAD_BYTES + 1),
        content_type='image/png',
    )

    with pytest.raises(ValidationError, match='5 MB'):
        validate_image_upload(upload)


def test_image_upload_rejects_invalid_content():
    from users.validators import validate_image_upload

    upload = SimpleUploadedFile(
        'fake.png',
        b'not-an-image',
        content_type='image/png',
    )

    with pytest.raises(ValidationError, match='imagen válida'):
        validate_image_upload(upload)


@pytest.mark.django_db
class TestExerciseValidators:
    def test_sets_zero_raises_validation_error(self, workout_day_a):
        """Exercise.sets=0 → ValidationError."""
        from plans.models import Exercise
        ex = Exercise(
            workout_day=workout_day_a,
            name='Test Exercise',
            muscle_group='chest',
            sets=0,
            reps_range='10',
            order=99,
        )
        with pytest.raises(ValidationError):
            ex.full_clean()

    def test_sets_above_max_raises_validation_error(self, workout_day_a):
        """Exercise.sets=21 (>20) → ValidationError."""
        from plans.models import Exercise
        ex = Exercise(
            workout_day=workout_day_a,
            name='Test Exercise',
            muscle_group='chest',
            sets=21,
            reps_range='10',
            order=99,
        )
        with pytest.raises(ValidationError):
            ex.full_clean()

    def test_reps_range_invalid_format_raises_error(self, workout_day_a):
        """Exercise.reps_range='abc' → ValidationError."""
        from plans.models import Exercise
        ex = Exercise(
            workout_day=workout_day_a,
            name='Test Exercise',
            muscle_group='chest',
            sets=3,
            reps_range='abc',
            order=99,
        )
        with pytest.raises(ValidationError):
            ex.full_clean()

    def test_reps_range_single_number_valid(self, workout_day_a):
        """Exercise.reps_range='8' → válido."""
        from plans.models import Exercise
        ex = Exercise(
            workout_day=workout_day_a,
            name='Test Exercise Single',
            muscle_group='chest',
            sets=3,
            reps_range='8',
            order=99,
        )
        try:
            ex.full_clean()
            ex.save()
        except ValidationError as e:
            pytest.fail(f"ValidationError inesperado: {e}")

    def test_reps_range_range_format_valid(self, workout_day_a):
        """Exercise.reps_range='8-12' → válido."""
        from plans.models import Exercise
        ex = Exercise(
            workout_day=workout_day_a,
            name='Test Exercise Range',
            muscle_group='chest',
            sets=3,
            reps_range='8-12',
            order=99,
        )
        try:
            ex.full_clean()
            ex.save()
        except ValidationError as e:
            pytest.fail(f"ValidationError inesperado: {e}")

    def test_weight_suggestion_negative_raises_error(self, workout_day_a):
        """Exercise.weight_suggestion_kg=-5 → ValidationError."""
        from plans.models import Exercise
        ex = Exercise(
            workout_day=workout_day_a,
            name='Test Exercise Negative Weight',
            muscle_group='chest',
            sets=3,
            reps_range='10',
            weight_suggestion_kg=-5.0,
            order=99,
        )
        with pytest.raises(ValidationError):
            ex.full_clean()

    def test_rest_seconds_above_600_raises_error(self, workout_day_a):
        """Exercise.rest_seconds=700 (>600) → ValidationError."""
        from plans.models import Exercise
        ex = Exercise(
            workout_day=workout_day_a,
            name='Test Exercise Rest',
            muscle_group='chest',
            sets=3,
            reps_range='10',
            rest_seconds=700,
            order=99,
        )
        with pytest.raises(ValidationError):
            ex.full_clean()

    def test_timed_exercise_requires_target_minutes(self, workout_day_a):
        from plans.models import Exercise

        ex = Exercise(
            workout_day=workout_day_a,
            name='Bici estatica',
            muscle_group='cardio',
            exercise_type='timed',
            sets=None,
            reps_range='',
            target_minutes=None,
            order=99,
        )

        with pytest.raises(ValidationError):
            ex.full_clean()

    def test_timed_exercise_with_minutes_is_valid(self, workout_day_a):
        from plans.models import Exercise

        ex = Exercise(
            workout_day=workout_day_a,
            name='Bici estatica',
            muscle_group='cardio',
            exercise_type='timed',
            sets=None,
            reps_range='',
            target_minutes=20,
            order=99,
        )

        ex.full_clean()

    def test_timed_exercise_rejects_strength_fields(self, workout_day_a):
        from plans.models import Exercise

        ex = Exercise(
            workout_day=workout_day_a,
            name='Bici estatica',
            muscle_group='cardio',
            exercise_type='timed',
            sets=3,
            reps_range='10',
            target_minutes=20,
            order=99,
        )

        with pytest.raises(ValidationError):
            ex.full_clean()
