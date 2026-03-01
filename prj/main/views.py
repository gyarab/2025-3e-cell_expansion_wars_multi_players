from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.views.decorators.csrf import csrf_protect
from django.utils import timezone
from asgiref.sync import sync_to_async
from django.core.exceptions import BadRequest
from django.db import IntegrityError, transaction
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import login, logout
from django.shortcuts import render
from django.http import HttpResponse
from django.conf import settings 
from main import models

content_type = "text/html; charset=utf-8"

def get_whole_name(user):
    names = [name for name in (user.first_name, user.last_name) if name != ""]
    return " ".join(names) if user.is_authenticated else None

def req_body(request):
    encoding = request.encoding
    if not encoding:
        encoding = settings.DEFAULT_CHARSET
    
    return request.body.decode(encoding)

success = HttpResponse("success", content_type="text/plain")
fail = HttpResponse("fail", content_type="text/plain")
yes = HttpResponse("yes", content_type="text/plain")
no = HttpResponse("no", content_type="text/plain")
st405 = HttpResponse(status=405)

# Create your views here.
async def homepage(request):
    if request != "GET":
        return st405

    name = get_whole_name(await request.auser())
    
    presets = []
    levels = []

    async for e in models.LevelOrPreset.objects.values("id", "level_or_preset", "visible_name", "enabled"):
        (levels if e.level_or_preset else presets).append((e.id, e.visible_name, e.enabled))

    data = {"levels": levels, "presets": presets, "whole_user_name": name}
    return render(request, "index.html", data, content_type=content_type)

async def username_exists(request, username):
    if request != "GET":
        return st405

    try:
        await models.Player.objects.values("username").aget(username=username)
    except models.Player.DoesNotExist:
        return no
    return yes

async def login_view(request):
    if request.method == "GET":
        data = {"whole_user_name": get_whole_name(await request.auser())}
        return render(request, "login.html", data, content_type=content_type)

    if request.method == "POST":
        try:
            login_str, passwd = req_body(request).strip().splitlines()
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
    if request != "POST":
        return st405
    
    logout(request)
    return success

async def user_profile(request, uid):
    if request != "GET":
        return st405

    player = await request.auser()
    data = {field: getattr(player, field) for field in ("email", "username", "first_name", "last_name")}
    return render(request, "user_profile.html", data, content_type=content_type)

async def change_user_info(request, uid):
    if request != "POST":
        return st405

    changable_fields = ("username", "first_name", "last_name")
    changes = [line.split(":") for line in req_body(request).strip().splitlines()]
    
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


MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 60

@csrf_protect
async def register_view(request):
    now_ts = timezone.now().timestamp()

    if request.method == "GET":
        return await sync_to_async(render)(request, "register.html")

    if request.method != "POST":
        return st405

    username = request.POST.get("username", "").strip().lower()
    email = request.POST.get("email", "").strip().lower()
    password = request.POST.get("password", "")

    # --- základní validace ---
    if len(username) > 30 or len(email) > 40 or not username or not email or not password:
        return fail

    try:
        validate_email(email)
    except ValidationError:
        return fail

    # --- vytvoření uživatele ---
    try:
        @sync_to_async
        def create_user():
            with transaction.atomic():
                player = models.Player(username=username, email=email)
                validate_password(password, user=player)
                player.set_password(password)
                player.save()
                return player

        player = await create_user()

    except (ValidationError, IntegrityError):
        return fail

    if not (await request.auser()).is_authenticated():
        await sync_to_async(login)(request, player)

    return success
