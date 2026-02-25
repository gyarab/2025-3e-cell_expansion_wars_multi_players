from django.db import models
from django.contrib.auth.models import AbstractBaseUser

class LevelOrPreset(models.Model):
    id = models.AutoField()
    level_or_preset = models.BooleanField()
    visible_name = models.CharField(max_length=15, null=True)
    enabled = models.BooleanField()
    data = models.JSONField(max_length=5000)

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
    game_state = models.JSONField(max_length=2500)

class Player(AbstractBaseUser):
    email = models.CharField(max_length=40, unique=True)
    first_name = models.CharField(max_length=30, blank=True)
    last_name = models.CharField(max_length=30, blank=True)
    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"

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
