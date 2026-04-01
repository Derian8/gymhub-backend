from django.urls import path
from .views import AIChatContextView, AIChatHistoryView, AIChatSendMessageView, AIChatView

urlpatterns = [
    path('ai-chat/', AIChatView.as_view(), name='ai-chat'),
    path('ai-chat/send-message/', AIChatSendMessageView.as_view(), name='ai-chat-send-message'),
    path('ai-chat/history/', AIChatHistoryView.as_view(), name='ai-chat-history'),
    path('ai-chat/context/', AIChatContextView.as_view(), name='ai-chat-context'),
]
