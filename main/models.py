from django.db import models
from django.contrib.auth.models import AbstractBaseUser

class LevelOrPreset(models.Model):
    id = models.AutoField(primary_key=True) # šimon
    level_or_preset = models.BooleanField()
    visible_name = models.CharField(max_length=15, null=True)
    enabled = models.BooleanField()
    data = models.JSONField()

class Playthrough(models.Model):
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField(null=True)
    level = models.OneToOneField(
        LevelOrPreset,
        on_delete=models.SET_NULL,
        related_name="playthrough",
        null=True
    )
    players = models.ManyToManyField(
        "Player",
        through="Player_Playthrough",
        related_name="playthroughs"
    )  
    game_state = models.JSONField()


from django.contrib.auth.models import AbstractBaseUser, BaseUserManager

class PlayerManager(BaseUserManager):
    def get_by_natural_key(self, username):
        return self.get(username=username)
    def create_superuser(self, username, password, **extra):
        user = self.model(
            username=username,
            email=extra.get("email", "")
        )
        user.set_password(password)
        user.is_superuser = True
        user.is_staff = True
        user.is_active = True
        user.save(using=self._db)
        return user


class Player(AbstractBaseUser):
    email = models.CharField(max_length=40, unique=True)
    username = models.CharField(max_length=30, unique=True)
    first_name = models.CharField(max_length=30, blank=True)
    last_name = models.CharField(max_length=30, blank=True)
    progress = models.JSONField(default=dict, blank=True)
    email_address_for_login = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    USERNAME_FIELD = "username"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = ["email"]
    objects = PlayerManager()
    def has_perm(self, perm, obj=None):
        return self.is_superuser
    def has_module_perms(self, app_label):
        return self.is_superuser
    def __str__(self):
        return self.username

class GameResult(models.Model):
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="game_results")
    level = models.ForeignKey(LevelOrPreset, on_delete=models.SET_NULL, null=True, related_name="game_results")
    result = models.CharField(max_length=10)
    score = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

class Player_Playthrough(models.Model):
    end_of_player_datetime = models.DateTimeField(null=True)
    virt_time_in_game = models.PositiveIntegerField()
    real_time_in_game = models.DurationField()
    registered_actions_count = models.PositiveIntegerField()
    playthrough = models.ForeignKey(Playthrough, on_delete=models.CASCADE)
    player = models.ForeignKey(Player, on_delete=models.CASCADE)

class GameAction(models.Model):
    virt_time_in_game = models.PositiveIntegerField()
    player = models.OneToOneField(
        Player,
        on_delete=models.SET_NULL,
        related_name="game_action",
        null=True
    )
    playthrough = models.ForeignKey(
        Playthrough,
        on_delete=models.CASCADE,
        related_name="game_actions"
    )
    action_type = models.PositiveSmallIntegerField()
    par1 = models.PositiveSmallIntegerField()
    par2 = models.PositiveSmallIntegerField()
