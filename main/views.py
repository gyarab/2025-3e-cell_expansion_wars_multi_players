from django.core.validators import validate_email 
from django.core.exceptions import ValidationError
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_POST
from django.utils import timezone
from asgiref.sync import sync_to_async
from django.db import IntegrityError, transaction
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import login as django_login, logout
from django.shortcuts import render
from django.http import HttpResponse, JsonResponse
from main import models
import json

for funcname in "django_login", "logout", "render":
    globals()[funcname] = sync_to_async(globals()[funcname])

content_type = "text/html; charset=utf-8"

def get_whole_name(user):
    if not user.is_authenticated:
        return None
    names = [name for name in (user.first_name, user.last_name) if name != ""]
    return " ".join(names) if names else user.username

success = HttpResponse("success", content_type=content_type)
fail = HttpResponse("fail", content_type=content_type)
yes = HttpResponse("yes", content_type=content_type)
no = HttpResponse("no", content_type=content_type)
st405 = HttpResponse(status=405)

@require_GET
async def homepage(request):
    user = await request.auser()
    name = get_whole_name(user)
    
    presets = []
    levels = []
    
    async for e in models.LevelOrPreset.objects.all():
        (levels if e.level_or_preset else presets).append((e.id, e.visible_name, e.enabled))

    data = {"levels": levels, "presets": presets, "whole_user_name": name}
    return await render(request, "all.html", data, content_type=content_type)

@require_GET
async def game_page(request):
    level_id = request.GET.get('level')
    
    if not level_id:
        return await homepage(request)
    
    try:
        level = await models.LevelOrPreset.objects.aget(id=int(level_id), level_or_preset=True)
    except (models.LevelOrPreset.DoesNotExist, ValueError):
        return await homepage(request)
    
    user = await request.auser()
    name = get_whole_name(user)
    
    data = {
        "level_id": level.id,
        "level_name": level.visible_name,
        "level_data": level.data,
        "whole_user_name": name,
    }
    
    return await render(request, "game.html", data, content_type=content_type)

@require_GET
async def get_level_data(request, level_id):
    try:
        level = await models.LevelOrPreset.objects.aget(id=level_id, level_or_preset=True)
        return JsonResponse({
            "id": level.id,
            "name": level.visible_name,
            "data": level.data,
        })
    except models.LevelOrPreset.DoesNotExist:
        return JsonResponse({"error": "Level not found"}, status=404)

@require_GET
async def username_exists(request, username):
    try:
        await models.Player.objects.values("username").aget(username=username)
    except models.Player.DoesNotExist:
        return no
    return yes

@require_POST
@csrf_protect
async def login_view(request):
    username = request.POST.get("username", "").strip().lower()
    password = request.POST.get("password", "")

    if not username or not password:
        return JsonResponse({"status": "fail", "error": "Vyplň jméno a heslo"})

    try:
        user = await models.Player.objects.aget(username=username)
    except models.Player.DoesNotExist:
        return JsonResponse({"status": "fail", "error": "Špatné přihlašovací údaje"})

    if not user.check_password(password):
        return JsonResponse({"status": "fail", "error": "Špatné přihlašovací údaje"})

    await django_login(request, user)
    
    progress = user.progress if isinstance(user.progress, dict) else {}
    
    return JsonResponse({
        "status": "success",
        "username": user.username,
        "progress": progress
    })

@require_POST
async def logout_view(request, uid):    
    await logout(request)
    return success

@require_GET
async def user_profile(request, uid):
    player = await request.auser()
    data = {field: getattr(player, field) for field in ("email", "username", "first_name", "last_name")}
    return await render(request, "all.html", data, content_type=content_type)

passwd_name = "pass"
@require_POST
@csrf_protect
async def change_user_info(request, uid):
    changable_fields = ("username", "first_name", "last_name")
    changes = list(request.POST.items())

    for change in changes:
        if len(change) != 2 or not (change[0] in changable_fields or change[0] == passwd_name):
            return st405

    try:
        @sync_to_async
        def make_the_change():
            with transaction.atomic():
                player = request.user
                for change in changes:
                    if change[0] == passwd_name:
                        validate_password(change[1], user=player)
                        player.set_password(change[1])
                    else:
                        setattr(player, *change)
                player.save()

        await make_the_change()
    except (IntegrityError, ValidationError):
        return fail
    
    return success

@csrf_protect
async def register_view(request):
    if request.method == "GET":
        return await render(request, "all.html")

    if request.method != "POST":
        return st405

    username = request.POST.get("username", "").strip().lower()
    password = request.POST.get("password", "")

    if not username or not password or len(username) > 30:
        return fail

    base_email = f"{username}@game.local"
    email = base_email
    i = 1
    while await models.Player.objects.filter(email=email).aexists():
        email = f"{username}{i}@game.local"
        i += 1

    try:
        @sync_to_async
        def create_user():
            with transaction.atomic():
                player = models.Player(username=username, email=email)
                player.set_password(password)
                player.save()
                return player

        player = await create_user()

    except Exception:
        return fail

    await django_login(request, player)
    return success

@require_GET
async def load_progress(request):
    user = await request.auser()
    if not user.is_authenticated:
        return JsonResponse({"progress": {}})

    progress = user.progress if isinstance(user.progress, dict) else {}
    return JsonResponse({"progress": progress})

@require_POST
@csrf_protect
async def save_progress(request):
    user = await request.auser()
    if not user.is_authenticated:
        return JsonResponse({"status": "fail"})

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
        progress = payload.get("progress", {})
        if not isinstance(progress, dict):
            raise ValueError
    except Exception:
        return JsonResponse({"status": "fail"})

    @sync_to_async
    def store_progress():
        user.progress = progress
        user.save(update_fields=["progress"])

    await store_progress()
    return JsonResponse({"status": "success"})

@require_POST
@csrf_protect
async def submit_result(request):
    user = await request.auser()
    if not user.is_authenticated:
        return fail

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
        level_id = int(payload.get("level_id", 0))
        result = str(payload.get("result", "")).lower()
        score = int(payload.get("score", 0))
        if result not in ("win", "lose"):
            raise ValueError
    except Exception:
        return fail

    try:
        level = await models.LevelOrPreset.objects.aget(id=level_id, level_or_preset=True)
    except models.LevelOrPreset.DoesNotExist:
        return fail

    @sync_to_async
    def save_game_result():
        models.GameResult.objects.create(player=user, level=level, result=result, score=score)

    await save_game_result()
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
    except (models.LevelOrPreset.DoesNotExist, models.Playthrough.DoesNotExist):
        return fail

    data = {
        "level_id": level.id,
        "level_name": level.visible_name,
        "playthrough_id": playthrough.id,
        "whole_user_name": get_whole_name(user),
    }

    return await render(request, "all.html", data, content_type=content_type)

@require_POST
@csrf_protect
async def multi_player_game_config(request, uid, preset_id):
    user = await request.auser()
    if not user.is_authenticated:
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
                game_state=preset.data
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

@require_GET
@csrf_protect
async def multi_player_game(request, uid, preset_id, game_id):
    user = await request.auser()
    if not user.is_authenticated:
        return fail

    try:
        play = await models.Playthrough.objects.aget(id=game_id)
    except models.Playthrough.DoesNotExist:
        return fail

    try:
        await models.Player_Playthrough.objects.aget(player=user, playthrough=play)
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
        "level_id": preset_id,
        "level_name": f"Zápas {play.id}",
        "level_data": play.game_state,
    }
    return await render(request, "game.html", data, content_type=content_type)