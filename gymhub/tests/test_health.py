import pytest
from rest_framework import status


@pytest.mark.django_db
class TestHealth:
    def test_live_health_returns_ok(self, api_client):
        response = api_client.get('/health/live/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'ok'
        assert response.data['service'] == 'gymhub-backend'

    def test_ready_health_returns_ok(self, api_client):
        response = api_client.get('/health/ready/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'ok'
        assert response.data['checks']['database']['status'] == 'ok'
        assert response.data['checks']['cache']['status'] == 'ok'
