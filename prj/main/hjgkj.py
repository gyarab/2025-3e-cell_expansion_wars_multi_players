from django.contrib.auth.password_validation import validate_password
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.db import transaction
from django.views.decorators.csrf import csrf_protect
from django.utils import timezone
from asgiref.sync import sync_to_async


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
