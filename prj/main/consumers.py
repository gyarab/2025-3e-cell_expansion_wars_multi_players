# chat/consumers.py
import json

from channels.generic.websocket import AsyncWebsocketConsumer


class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.game_grp_id = f"pl{self.scope["url_route"]["kwargs"]["game_id"]}"

        # Join room group
        await self.channel_layer.group_add(self.game_grp_id, self.channel_name)

        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(self.game_grp_id, self.channel_name)

    # Receive message from WebSocket
    async def receive(self, text_data):
        text_data_json = json.loads(text_data)

        # Send message to room group
        await self.channel_layer.group_send(
            self.game_grp_id, {"type": "game.change", "change": text_data_json}
        )

    # Receive message from room group
    async def game_change(self, event):
        # Send message to WebSocket
        await self.send(text_data=json.dumps(event["change"]))