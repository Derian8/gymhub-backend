from django.urls import path
from .views import AIChatView, AIChatHistoryView

urlpatterns = [
    path('ai-chat/', AIChatView.as_view(), name='ai-chat'),
    path('ai-chat/history/', AIChatHistoryView.as_view(), name='ai-chat-history'),
]
