"""
test_validators.py — Tests de validadores de modelos (Exercise fields).
"""
import pytest
from django.core.exceptions import ValidationError


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
