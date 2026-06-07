from main.models import LevelOrPreset

# Data úrovní ze main.js
levels_data = {
    1: {
        "cells": [
            {"id": 1, "x": 100, "y": 300, "color": "green", "lives": 30},
            {"id": 2, "x": 500, "y": 400, "color": "purple", "lives": 60},
            {"id": 3, "x": 900, "y": 100, "color": "blue", "lives": 20},
            {"id": 4, "x": 400, "y": 700, "color": "blue", "lives": 20}
        ]
    },
    2: {
        "cells": [
            {"id": 1, "x": 100, "y": 100, "color": "green", "lives": 60},
            {"id": 2, "x": 800, "y": 300, "color": "purple", "lives": 60},
            {"id": 3, "x": 500, "y": 700, "color": "purple", "lives": 60},
            {"id": 4, "x": 300, "y": 300, "color": "blue", "lives": 20},
            {"id": 5, "x": 600, "y": 200, "color": "blue", "lives": 20},
            {"id": 6, "x": 800, "y": 700, "color": "blue", "lives": 20}
        ]
    },
    3: {
        "cells": [
            {"id": 1, "x": 100, "y": 400, "color": "green", "lives": 50},
            {"id": 2, "x": 900, "y": 400, "color": "purple", "lives": 50},
            {"id": 3, "x": 500, "y": 150, "color": "purple", "lives": 80},
            {"id": 4, "x": 500, "y": 650, "color": "blue", "lives": 40},
            {"id": 5, "x": 300, "y": 200, "color": "blue", "lives": 25},
            {"id": 6, "x": 700, "y": 200, "color": "blue", "lives": 25},
            {"id": 7, "x": 300, "y": 600, "color": "blue", "lives": 25},
            {"id": 8, "x": 700, "y": 600, "color": "blue", "lives": 25}
        ]
    }
}

# Naplnit databázi daty
for level_id, level_data in levels_data.items():
    level = LevelOrPreset.objects.get(id=level_id)
    level.data = level_data
    level.save()
    print(f"Level {level_id} updated with {len(level_data['cells'])} cells")

print("✓ Všechny úrovně byly naplněny daty!")
