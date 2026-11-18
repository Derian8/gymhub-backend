import pytest
from rest_framework.test import APIClient

from billing.serializers import MemberMembershipSerializer, MemberSubscriptionSerializer


def test_estado_cliente_es_un_campo_de_las_dos_representaciones():
    for serializador in (MemberMembershipSerializer, MemberSubscriptionSerializer):
        assert 'estado_cliente' in serializador().fields


@pytest.mark.django_db
def test_esquema_publico_responde_con_membresias():
    respuesta = APIClient().get('/api/schema/', secure=True)
    assert respuesta.status_code == 200
    assert 'estado_cliente' in respuesta.data['components']['schemas']['MemberMembership']['properties']
