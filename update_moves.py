import json


REQUIRED_MOVE_FIELDS = {"name", "type", "category", "power", "accuracy", "pp", "maxPp"}


with open("pokemon.json", "r") as file:
    pokemon_data = json.load(file)

errors = []
for pokemon in pokemon_data:
    moves = pokemon.get("moves", [])
    if not moves or len(moves) > 4:
        errors.append(f"{pokemon['name']} must have 1-4 moves")
        continue

    for move in moves:
        missing = REQUIRED_MOVE_FIELDS - move.keys()
        if missing:
            errors.append(
                f"{pokemon['name']} / {move.get('name', 'unknown')} missing {sorted(missing)}"
            )
        move["currentPp"] = min(move.get("currentPp", move["maxPp"]), move["maxPp"])

if errors:
    raise SystemExit("\n".join(errors))

with open("pokemon.json", "w") as file:
    json.dump(pokemon_data, file, indent=2)
    file.write("\n")

print(f"Validated {len(pokemon_data)} Pokemon move sets.")
