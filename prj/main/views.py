from django.shortcuts import render
from main import models

def get_whole_name(user):
    return " ".join((user.first_name, user.last_name)) if user.is_authenticated else ""

# Create your views here.
async def homepage(request):
    name = get_whole_name(await request.auser())
    
    presets = []
    levels = []
    data = {"levels": levels, "presets": presets, "whole_user_name": name}

    async for e in models.LevelOrPreset.objects.values("id", "level_or_preset", "visible_name", "enabled"):
        (levels if e.level_or_preset else presets).append((e.id, e.visible_name, e.enabled))

    return render(request, "templates/index.html", data, content_type="text/html; charset=utf-8")
