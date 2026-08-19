import pytest

from users.models import ConfiguracionSistema, requiere_cambio_contrasena_efectivo


@pytest.mark.django_db
def test_configuracion_exige_cambio_por_defecto(member_user):
    member_user.requiere_cambio_contrasena = True
    member_user.save(update_fields=['requiere_cambio_contrasena'])

    assert ConfiguracionSistema.principal().exigir_cambio_contrasena_cliente is True
    assert requiere_cambio_contrasena_efectivo(member_user) is True


@pytest.mark.django_db
def test_configuracion_demo_desactiva_cambio_solo_para_clientes(member_user, trainer_user):
    ConfiguracionSistema.principal().exigir_cambio_contrasena_cliente = False
    ConfiguracionSistema.principal().save(update_fields=['exigir_cambio_contrasena_cliente', 'actualizado_en'])
    member_user.requiere_cambio_contrasena = True
    member_user.save(update_fields=['requiere_cambio_contrasena'])
    trainer_user.requiere_cambio_contrasena = True
    trainer_user.save(update_fields=['requiere_cambio_contrasena'])

    assert requiere_cambio_contrasena_efectivo(member_user) is False
    assert requiere_cambio_contrasena_efectivo(trainer_user) is True
