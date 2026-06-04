from django.urls import re_path
from main import consumers

websocket_urlpatterns = [
    re_path(
        r"^ws/user(?P<uid>[0-9]+)/preset(?P<preset_id>[0-9]+)/game(?P<game_id>[0-9]+)/?$",
        consumers.GameConsumer.as_asgi()
    ),
]