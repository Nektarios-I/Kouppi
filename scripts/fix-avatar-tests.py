from pathlib import Path
import re

files = [
    Path(r"C:\Users\User\Desktop\KOUPPI\kouppi\apps\web\store\careerLobbyStore.test.ts"),
    Path(r"C:\Users\User\Desktop\KOUPPI\kouppi\apps\web\__tests__\remoteGameStore.test.ts"),
    Path(r"C:\Users\User\Desktop\KOUPPI\kouppi\apps\web\__tests__\multiplayer.lobby.test.tsx"),
    Path(r"C:\Users\User\Desktop\KOUPPI\kouppi\apps\web\__tests__\PlayerSeat.test.tsx"),
    Path(r"C:\Users\User\Desktop\KOUPPI\kouppi\apps\server\tests\production.multiplayer.test.ts"),
    Path(r"C:\Users\User\Desktop\KOUPPI\kouppi\apps\server\tests\career\careerGameFlow.test.ts"),
    Path(r"C:\Users\User\Desktop\KOUPPI\kouppi\apps\server\tests\career\careerSecurity.test.ts"),
    Path(r"C:\Users\User\Desktop\KOUPPI\kouppi\apps\server\tests\career\ratingDeltaGameEnd.test.ts"),
    Path(r"C:\Users\User\Desktop\KOUPPI\kouppi\apps\server\tests\career\waitingTables.test.ts"),
]

block = re.compile(
    r"avatarEmoji:\s*[^,\n]+,\s*\n\s*avatarColor:\s*[^,\n]+,\s*\n\s*avatarBorder:\s*[^,\n]+,",
    re.M,
)
avatar_obj = re.compile(
    r'avatar:\s*\{\s*emoji:\s*"[^"]*",\s*color:\s*"[^"]*",\s*borderColor:\s*"[^"]*"\s*\}'
)

for p in files:
    if not p.exists():
        print("missing", p)
        continue
    t = p.read_text(encoding="utf-8")
    orig = t
    t = block.sub('avatarId: "portrait-01",', t)
    t = avatar_obj.sub('avatar: { id: "portrait-01" }', t)
    t = t.replace("host.avatarEmoji", "host.avatarId")
    t = t.replace(
        '{"emoji":"🎮","color":"#000","borderColor":"#111"}',
        '{"id":"portrait-01"}',
    )
    t = t.replace("player.avatar?.emoji", "player.avatar?.id")
    # waiting tables may still have color/border lines after host.avatarId replacement
    t = re.sub(r"\n\s*avatarColor:\s*host\.avatarColor,", "", t)
    t = re.sub(r"\n\s*avatarBorder:\s*host\.avatarBorder,", "", t)
    if t != orig:
        p.write_text(t, encoding="utf-8")
        print("updated", p.name)
    else:
        print("nochange", p.name)
