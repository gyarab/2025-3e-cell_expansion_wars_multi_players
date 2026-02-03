from django.db import models

class Level(models.Model):
    data = models.JSONField(max_length=5000)

class Playthrough(models.Model):
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()
    level = models.OneToOneField(
        Level,
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

class Player(models.Model):
    email = models.CharField(max_length=35)
    first_name = models.CharField(max_length=30)
    last_name = models.CharField(max_length=30)
    password_hash = models.BinaryField(max_length=32)

class Player_Playthrough(models.Model):
    end_of_player_datetime = models.DateTimeField(null=True)
    virt_time_in_game = models.PositiveIntegerField()
    real_time_in_game = models.DurationField()
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
