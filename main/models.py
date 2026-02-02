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

class Player(models.Model):
    email = models.CharField(max_length=35)
    first_name = models.CharField(max_length=30)
    last_name = models.CharField(max_length=30)
    password_hash = models.BinaryField(max_length=32)

class Player_Playthrough(models.Model):
    time_in_game = models.PositiveIntegerField()
    real_time = models.DurationField()
    playthrough = models.ForeignKey(Playthrough, on_delete=models.SET_NULL, null=True)
    player = models.ForeignKey(Player, on_delete=models.SET_NULL, null=True)
