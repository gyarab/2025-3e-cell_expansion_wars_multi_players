from django.shortcuts import render as render_
from main import models

content_type = "text/html; charset=utf-8"
templates_dir = "templates/"
def render(template, *args, **kwargs):
    return render(args[0], templates_dir+template, *args[1:], content_type=content_type, **kwargs)

def get_whole_name(user):
    names = [name for name in (user.first_name, user.last_name) if name != ""]
    return " ".join(names) if user.is_authenticated else None

# Create your views here.
async def homepage(request):
    name = get_whole_name(await request.auser())
    
    presets = []
    levels = []

    async for e in models.LevelOrPreset.objects.values("id", "level_or_preset", "visible_name", "enabled"):
        (levels if e.level_or_preset else presets).append((e.id, e.visible_name, e.enabled))

    data = {"levels": levels, "presets": presets, "whole_user_name": name}
    return render("index.html", request, data)

async def login(request):
    if request.method == "GET":
        data = {"whole_user_name": get_whole_name(await request.auser())}
        return render("login.html", request, data)
