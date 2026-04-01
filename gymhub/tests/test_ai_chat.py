import pytest
from unittest.mock import patch

from rest_framework import status

from ai_chat.engine import ChatGenerationResult


@pytest.mark.django_db
class TestAIChat:
    def test_member_chat_works_without_provider_keys(self, settings, member_client, member_profile):
        settings.AI_PROVIDER = 'deterministic'

        resp = member_client.post('/api/ai-chat/', {'message': 'Hola, que hago hoy?'}, format='json')

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['mode'] == 'member'
        assert resp.data['engine_mode'] == 'deterministic'
        assert resp.data['response_source'] == 'rules'
        assert 'prioridad de hoy' in resp.data['content'].lower()

        from ai_chat.models import AIChatConversation, AIChatMessage

        conversation = AIChatConversation.objects.get(usuario=member_profile.user, member=member_profile, modo='member')
        assert conversation.id == resp.data['conversation_id']
        assert AIChatMessage.objects.filter(conversation=conversation).count() == 2

    def test_member_limit_blocks_message_after_daily_cap(self, member_client, member_profile):
        from ai_chat.models import AIChatConversation, AIChatMessage

        conversation = AIChatConversation.objects.create(
            usuario=member_profile.user,
            member=member_profile,
            modo='member',
        )
        for index in range(20):
            AIChatMessage.objects.create(
                conversation=conversation,
                member=member_profile,
                role='user',
                content=f'Mensaje {index}',
            )

        resp = member_client.post('/api/ai-chat/', {'message': 'Mensaje 21'}, format='json')

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['content'] == 'Has alcanzado el límite diario.'
        assert resp.data['limit_reached'] is True
        assert resp.data['response_source'] == 'rules'

    def test_trainer_chat_is_contextual_without_external_ai(self, settings, trainer_client, member_profile):
        settings.AI_PROVIDER = 'deterministic'

        resp = trainer_client.post(
            '/api/ai-chat/',
            {'message': '¿En qué debo enfocarme?', 'member_id': member_profile.id},
            format='json',
        )

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['mode'] == 'trainer_member'
        assert resp.data['engine_mode'] == 'deterministic'
        assert 'lectura del caso' in resp.data['content'].lower()

    def test_trainer_chat_can_generate_sendable_member_message(self, settings, trainer_client, member_profile):
        settings.AI_PROVIDER = 'deterministic'

        resp = trainer_client.post(
            '/api/ai-chat/',
            {'message': 'Escribe un mensaje corto para este cliente', 'member_id': member_profile.id},
            format='json',
        )

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['sendable'] is True
        assert resp.data['message_text']
        assert resp.data['priority_detected'] in ('payment', 'adherence', 'workout', 'nutrition')

    def test_trainer_can_send_generated_message_to_member_notification(self, trainer_client, member_profile):
        from alerts.models import Notification

        chat_resp = trainer_client.post(
            '/api/ai-chat/',
            {'message': 'Escribe un mensaje corto para este cliente', 'member_id': member_profile.id},
            format='json',
        )

        send_resp = trainer_client.post(
            '/api/ai-chat/send-message/',
            {
                'member_id': member_profile.id,
                'message_text': chat_resp.data['message_text'],
                'conversation_id': chat_resp.data['conversation_id'],
                'source_message_id': chat_resp.data['message_id'],
            },
            format='json',
        )

        assert send_resp.status_code == status.HTTP_200_OK
        assert send_resp.data['sent'] is True
        notification = Notification.objects.get(id=send_resp.data['notification_id'])
        assert notification.user == member_profile.user
        assert notification.type == 'trainer_message'
        assert notification.message == chat_resp.data['message_text']

    def test_trainer_cannot_send_message_to_foreign_member(self, trainer_client, membership_plan):
        from datetime import date
        from django.contrib.auth import get_user_model
        from users.models import MemberProfile

        User = get_user_model()
        other_trainer_user = User.objects.create_user(
            username='other_trainer_ai',
            email='other_trainer_ai@test.com',
            password='trainer123!',
            role='trainer',
        )
        foreign_member_user = User.objects.create_user(
            username='foreign_member_ai',
            email='foreign_member_ai@test.com',
            password='member123!',
            role='member',
        )
        foreign_member = foreign_member_user.memberprofile
        foreign_member.trainer_asignado = other_trainer_user.trainerprofile
        foreign_member.membership_plan = membership_plan
        foreign_member.join_date = date.today()
        foreign_member.is_active = True
        foreign_member.save()

        send_resp = trainer_client.post(
            '/api/ai-chat/send-message/',
            {
                'member_id': foreign_member.id,
                'message_text': 'Corrige tu adherencia hoy.',
            },
            format='json',
        )

        assert send_resp.status_code == status.HTTP_403_FORBIDDEN

    @patch('ai_chat.views.generate_chat_response')
    def test_local_hybrid_response_reports_local_model_usage(self, mock_generate, settings, member_client):
        settings.AI_PROVIDER = 'local_hybrid'
        mock_generate.return_value = ChatGenerationResult(
            content='Respuesta mejorada por modelo local.',
            engine_mode='local_hybrid',
            local_llm_used=True,
            response_source='local_model',
        )

        resp = member_client.post('/api/ai-chat/', {'message': 'Hola'}, format='json')

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['engine_mode'] == 'local_hybrid'
        assert resp.data['local_llm_used'] is True
        assert resp.data['response_source'] == 'local_model'

    def test_trainer_history_requires_member_id_but_stays_safe(self, trainer_client):
        resp = trainer_client.get('/api/ai-chat/history/')

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data == []

    def test_history_is_isolated_between_member_and_trainer(self, member_client, trainer_client, member_profile):
        member_client.post('/api/ai-chat/', {'message': 'Hola member'}, format='json')
        trainer_client.post(
            '/api/ai-chat/',
            {'message': 'Hola trainer', 'member_id': member_profile.id},
            format='json',
        )

        member_history = member_client.get('/api/ai-chat/history/')
        trainer_history = trainer_client.get('/api/ai-chat/history/', {'member_id': member_profile.id})

        assert member_history.status_code == status.HTTP_200_OK
        assert trainer_history.status_code == status.HTTP_200_OK
        assert member_history.data[0]['content'] == 'Hola member'
        assert trainer_history.data[0]['content'] == 'Hola trainer'
        assert all(item['mode'] == 'member' for item in member_history.data)
        assert all(item['mode'] == 'trainer_member' for item in trainer_history.data)

    def test_context_endpoint_for_member_reports_engine_status(self, settings, member_client):
        settings.AI_PROVIDER = 'deterministic'

        resp = member_client.get('/api/ai-chat/context/')

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['mode'] == 'member'
        assert resp.data['requires_member_selection'] is False
        assert resp.data['engine_mode'] == 'deterministic'
        assert resp.data['local_llm_available'] is False
        assert len(resp.data['suggested_prompts']) >= 3

    def test_context_endpoint_for_trainer_without_member_requests_selection(self, trainer_client):
        resp = trainer_client.get('/api/ai-chat/context/')

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['mode'] == 'trainer_member'
        assert resp.data['requires_member_selection'] is True
        assert resp.data['member'] is None
