from django.core.exceptions import BadRequest
from django.db import IntegrityError
from django.contrib.auth import login, logout
from django.shortcuts import render as render_
from django.http import HttpResponse
from main import models

content_type = "text/html; charset=utf-8"
templates_dir = "templates/"
def render(template, *args, **kwargs):
    return render(args[0], templates_dir+template, *args[1:], content_type=content_type, **kwargs)

def get_whole_name(user):
    names = [name for name in (user.first_name, user.last_name) if name != ""]
    return " ".join(names) if user.is_authenticated else None

def check_method(request, m):
    if request.method != m:
        raise BadRequest()
    

success = HttpResponse("success", content_type="text/plain")
fail = HttpResponse("fail", content_type="text/plain")

# Create your views here.
async def homepage(request):
    check_method(request, "GET")

    name = get_whole_name(await request.auser())
    
    presets = []
    levels = []

    async for e in models.LevelOrPreset.objects.values("id", "level_or_preset", "visible_name", "enabled"):
        (levels if e.level_or_preset else presets).append((e.id, e.visible_name, e.enabled))

    data = {"levels": levels, "presets": presets, "whole_user_name": name}
    return render("index.html", request, data)

async def login_view(request):
    if request.method == "GET":
        data = {"whole_user_name": get_whole_name(await request.auser())}
        return render("login.html", request, data)

    if request.method == "POST":
        data = request.read(164)    # Max: 40 chars email (max length of username is 30), 40 chars password, 4 chars 2x \r\n
        try:
            login_str, passwd = data.strip().splitlines()
        except Exception:
            raise BadRequest()


        try:
            if "@" in login_str:
                user = await models.Player.objects.aget(email=login_str)
            else:
                user = await models.Player.objects.aget(username=login_str)
        except models.Player.DoesNotExist:
            return fail

        if user.check_password(passwd):
            login(request, user)
            return success

        return fail
    
    raise BadRequest()
    
async def logout_view(request, uid):
    check_method(request, "POST")
    logout(request)
    return HttpResponse("success", content_type="text/plain")

async def user_profile(request, uid):
    check_method(request, "GET")

    player = await request.auser()
    data = {field: getattr(player, field) for field in ("email", "username", "first_name", "last_name")}
    return render("user_profile.html", request, data)

async def change_user_info(request, uid):
    check_method(request, "POST")

    changable_fields = ("username", "first_name", "last_name")
    changes = [line.split(":") for line in request.read(184).strip().splitlines()]
    
    for change in changes:
        if len(change) != 2 or not change[0] in changable_fields:
            raise BadRequest()

    player = await request.auser()
    
    for change in changes:
        setattr(player, *change)

    try:
        player.save()
    except IntegrityError:
        return fail
    
    return success

