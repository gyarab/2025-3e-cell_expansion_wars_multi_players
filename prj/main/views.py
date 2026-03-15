from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_POST
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

for funcname in "login", "logout", "render":
    globals()[funcname] = sync_to_async(globals()[funcname])

content_type = "text/html; charset=utf-8"

def get_whole_name(user):
    names = [name for name in (user.first_name, user.last_name) if name != ""]
    return " ".join(names) if user.is_authenticated else None

"""
def req_body(request):
    encoding = request.encoding
    if not encoding:
        encoding = settings.DEFAULT_CHARSET
    
    return request.body.decode(encoding)
"""

success = HttpResponse("success", content_type=content_type)
fail = HttpResponse("fail", content_type=content_type)
yes = HttpResponse("yes", content_type=content_type)
no = HttpResponse("no", content_type=content_type)
st405 = HttpResponse(status=405)

@require_GET
async def homepage(request):
    name = get_whole_name(await request.auser())
    
    presets = []
    levels = []

    async for e in models.LevelOrPreset.objects.values("id", "level_or_preset", "visible_name", "enabled"):
        (levels if e.level_or_preset else presets).append((e.id, e.visible_name, e.enabled))

    data = {"levels": levels, "presets": presets, "whole_user_name": name}
    return render(request, "index.html", data, content_type=content_type)

@require_GET
async def username_exists(request, username):
    try:
        await models.Player.objects.values("username").aget(username=username)
    except models.Player.DoesNotExist:
        return no
    return yes

@csrf_protect
async def login_view(request):
    if request.method == "GET":
        data = {"whole_user_name": get_whole_name(await request.auser())}
        return render(request, "login.html", data, content_type=content_type)

    if request.method == "POST":
        try:
            login_str, passwd = list(request.POST.items())
        except Exception:
            st405

        try:
            if "@" in login_str:
                user = await models.Player.objects.aget(email=login_str)
            else:
                user = await models.Player.objects.aget(username=login_str)
        except models.Player.DoesNotExist:
            return fail

        if user.check_password(passwd):
            await login(request, user)
            return success

        return fail
    
    return st405

@require_POST
async def logout_view(request, uid):    
    logout(request)
    return success

@require_GET
async def user_profile(request, uid):
    player = await request.auser()
    data = {field: getattr(player, field) for field in ("email", "username", "first_name", "last_name")}
    return render(request, "user_profile.html", data, content_type=content_type)

@require_POST
@csrf_protect
async def change_user_info(request, uid):
    changable_fields = ("username", "first_name", "last_name")
    changes = list(request.POST.items())

    for change in changes:
        if len(change) != 2 or not change[0] in changable_fields:
            return st405

    try:
        @sync_to_async
        def make_the_change():
            with transaction.atomic():
                player = request.user
                for change in changes:
                    setattr(player, *change)
                player.save()

        await make_the_change()
    except IntegrityError:
        return fail
    
    return success


@csrf_protect
async def register_view(request):
    if request.method == "GET":
        return await render(request, "register.html")

    if request.method != "POST":
        return st405

    username = request.POST.get("username", "").strip().lower()
    email = request.POST.get("email", "").strip().lower()
    password = request.POST.get("password", "")

    # --- validation ---
    if len(username) > 30 or len(email) > 40 or not username or not email or not password:
        return fail

    try:
        validate_email(email)
    except ValidationError:
        return fail

    # --- user creation ---
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

    if not (await request.auser()).is_authenticated:
        await login(request, player)

    return success

@csrf_protect
async def game(request, uid, level_id, game_id):
    if request.method != "GET":
        return st405

    user = await request.auser()

    if not user.is_authenticated:
        return fail

    try:
        level = await models.LevelOrPreset.objects.aget(id=level_id, level_or_preset=True)
        playthrough = await models.Playthrough.objects.aget(id=game_id, level=level)
    except models.LevelOrPreset.DoesNotExist:
        return fail
    except models.Playthrough.DoesNotExist:
        return fail

    data = {
        "level_id": level.id,
        "level_name": level.visible_name,
        "playthrough_id": playthrough.id,
        "whole_user_name": get_whole_name(user),
    }

    return await render(request, "game.html", data, content_type=content_type)

@csrf_protect
async def multi_player_game_config(request, uid, preset_id):
    if request.method != "POST":
        return st405

    user = await request.auser()

    if not user.is_authenticated or user.id != int(uid):
        return fail

    try:
        preset = await models.LevelOrPreset.objects.aget(id=preset_id, level_or_preset=False)
    except models.LevelOrPreset.DoesNotExist:
        return fail

    @sync_to_async
    def create_playthrough():
        with transaction.atomic():
            play = models.Playthrough.objects.create(
                start_datetime=timezone.now(),
                level=preset,
                game_state={}
            )

            models.Player_Playthrough.objects.create(
                player=user,
                playthrough=play,
                virt_time_in_game=0,
                real_time_in_game=0,
                registered_actions_count=0
            )

            return play.id

    play_id = await create_playthrough()

    return HttpResponse(str(play_id), content_type="text/plain")

@csrf_protect
async def multi_player_game(request, uid, preset_id, game_id):
    if request.method != "GET":
        return st405

    user = await request.auser()

    if not user.is_authenticated or user.id != int(uid):
        return fail

    try:
        play = await models.Playthrough.objects.aget(id=game_id)
    except models.Playthrough.DoesNotExist:
        return fail

    # ověř že user patří do hry
    try:
        await models.Player_Playthrough.objects.aget(
            player=user,
            playthrough=play
        )
    except models.Player_Playthrough.DoesNotExist:
        return fail

    players = []

    async for p in models.Player.objects.filter(playthroughs=play).values("id", "username"):
        players.append(p)

    data = {
        "playthrough_id": play.id,
        "preset_id": preset_id,
        "players": players,
        "whole_user_name": get_whole_name(user),
    }

    return await render(request, "multi_game.html", data, content_type=content_type)