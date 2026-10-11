# Fetch game sound effects from Freesound (CC0 and CC BY only), process them and write sfx/<name><n>.mp3.
# Runs in GitHub Actions (.github/workflows/freesound-sfx.yml) with the repository secret FREESOUND_API_KEY.
# Only the public HQ previews are used (no OAuth). Every file is trimmed, faded, loudness-matched and saved as mono MP3 (< 100 KB).
# Writes tools/freesound_credits.json and tools/freesound_credits.md for CREDITS.md.
import json, os, subprocess, sys, time, urllib.parse, urllib.request
import numpy as np

KEY = os.environ['FREESOUND_API_KEY']
SR = 44100
OUT = 'sfx'
TMP = '/tmp/fs'
os.makedirs(TMP, exist_ok=True)
LICENSES = {'Creative Commons 0': 'CC0', 'Attribution': 'CC BY'}
BANNED = ('sonniss', 'gdc', 'bbc')  # bundles we do not take, whatever their licence says

# name: (search queries, min s, max s, kept length s, target loudness dB, low boost dB)
# Mode: with tools/freesound_picks.json ({name: [sound ids]}) only those sounds are fetched; without it the script lists candidates
# (tools/freesound_candidates.json) for a person to choose from, and leaves sfx/ alone.
WANT = {
    'cannon':   (['cannon fire', 'cannon shot', 'artillery blast'], 0.8, 8, 2.4, -11, 4),
    'glass':    (['glass shatter', 'glass smash', 'glass break large'], 0.4, 5, 2.0, -14, 0),
    'window':   (['window break', 'window smash'], 0.4, 5, 2.0, -14, 0),
    'wood':     (['wood break', 'wood smash', 'plank break', 'wooden crate break'], 0.3, 4, 1.4, -14, 3),
    'hay':      (['hay bale', 'straw', 'hay impact', 'cardboard box impact'], 0.3, 4, 1.2, -17, 0),
    'brick':    (['brick wall collapse', 'bricks falling'], 0.5, 6, 2.0, -14, 4),
    'stone':    (['rock impact', 'stone smash', 'concrete smash', 'rock break'], 0.3, 5, 1.8, -14, 4),
    'ice':      (['ice break', 'ice shatter'], 0.3, 5, 1.6, -14, 0),
    'metal':    (['metal impact', 'metal hit heavy', 'steel clang', 'anvil hit'], 0.3, 4, 1.6, -14, 2),
    'vault':    (['heavy metal door slam', 'vault door slam'], 0.5, 6, 2.4, -12, 5),
    'rip':      (['metal tear', 'metal rip', 'metal bend scrape', 'sheet metal tear'], 0.3, 4, 1.4, -14, 0),
    'thud':     (['body fall thud', 'heavy thud', 'body fall'], 0.2, 3, 0.8, -15, 5),
    'truck':    (['truck crash', 'heavy metal crash', 'car crash heavy'], 0.6, 6, 2.2, -12, 5),
    'car':      (['car crash', 'car impact', 'car collision'], 0.6, 6, 2.2, -12, 4),
    'tires':    (['tire impact', 'rubber thud', 'tyre bounce', 'tire hit'], 0.2, 3, 0.9, -15, 5),
    'sand':     (['sand pour', 'sand falling', 'gravel pour'], 0.5, 6, 1.6, -18, 0),
    'body':     (['robot impact', 'robot fall', 'metal body hit', 'armor impact'], 0.2, 3, 1.0, -15, 3),
    'creak':    (['metal creak', 'metal groan'], 0.5, 5, 1.6, -17, 0),
    'hdboom':   (['cinematic boom', 'cinematic impact', 'sub boom', 'trailer hit', 'sub drop'], 1.0, 8, 3.2, -9, 4),
    'uihit':    (['cinematic hit short', 'impact punch cinematic', 'trailer hit', 'cinematic impact short'], 0.3, 4, 1.4, -13, 3),
    'uirise':   (['whoosh riser short', 'swoosh up', 'riser whoosh', 'power up whoosh'], 0.4, 4, 1.6, -15, 0),
    'uitick':   (['ui click metallic', 'mechanical click', 'interface click'], 0.03, 1, 0.4, -18, 0),
    'jump':     (['whoosh', 'quick woosh'], 0.3, 4, 1.0, -16, 0),
    'land':     (['car landing', 'car land impact'], 0.3, 4, 1.2, -14, 4),
    'win':      (['crowd cheer short', 'crowd cheering', 'audience cheer'], 1, 8, 3.0, -16, 0),
    # loops (last field 'loop'): kept length = loop period in seconds; the file holds the seamless loop twice, the game loops its middle
    'roll':     (['skateboard rolling', 'skateboard roll loop', 'skateboard cruising'], 3, 120, 2.5, -20, 'loop'),
    'cart':     (['shopping cart rolling', 'trolley rolling', 'shopping trolley'], 3, 120, 2.5, -20, 'loop'),
    'road':     (['car interior road noise', 'tire road noise', 'car driving interior'], 3, 120, 2.5, -20, 'loop'),
    'drone':    (['drone flying', 'quadcopter hover', 'drone hovering'], 3, 120, 3.0, -20, 'loop'),
    'ambcity':  (['city ambience rooftop', 'city ambience distant traffic', 'city rooftop wind'], 10, 600, 6.0, -24, 'loop'),
    'ambsky':   (['high altitude wind', 'mountain wind ambience', 'wind ambience strong'], 10, 600, 6.0, -24, 'loop'),
    'amblab':   (['warehouse room tone', 'factory hall ambience', 'industrial room tone'], 10, 600, 6.0, -26, 'loop'),
    'hdwhoosh': (['heavy whoosh', 'swing whoosh', 'whoosh large', 'pass by whoosh'], 0.4, 4, 2.0, -14, 0),
}
PER_NAME = 3

def api(path, **q):
    q['token'] = KEY
    url = 'https://freesound.org/apiv2/' + path + '?' + urllib.parse.urlencode(q)
    for i in range(4):
        try:
            with urllib.request.urlopen(url, timeout=30) as r: return json.load(r)
        except Exception as e:
            print('  retry', path, e); time.sleep(2 * (i + 1))
    raise SystemExit('API failed: ' + path)

FIELDS = 'id,name,username,license,url,previews,duration,tags,description,pack,avg_rating,num_downloads'
def search(query, dmin, dmax, sort='score'):
    lic = ' OR '.join('"%s"' % k for k in LICENSES)
    r = api('search/text/', query=query, filter='license:(%s) duration:[%s TO %s]' % (lic, dmin, dmax), sort=sort, page_size=25,
            fields='id,name,username,license,url,previews,duration,tags,description,pack,avg_rating,num_downloads')
    return r.get('results', [])

def lic_short(u):
    for k, v in LICENSES.items():
        if ('publicdomain/zero' in u and v == 'CC0') or ('/by/' in u and v == 'CC BY'): return v, u
    return None, u

def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)

def onepole(x, f):
    a = np.exp(-2 * np.pi * f / SR); y = np.empty_like(x); s = 0.0
    for i in range(len(x)): s = (1 - a) * x[i] + a * s; y[i] = s
    return y

def process(x, keep, rms, bass):
    pk = np.abs(x).max()
    if pk < 1e-4: return None
    i = max(0, int(np.argmax(np.abs(x) > pk * 0.05)) - int(0.004 * SR)); x = x[i:]
    x = x - onepole(x, 28)
    if bass: x = x + onepole(x, 140) * (10 ** (bass / 20) - 1)
    env = np.abs(x); above = np.where(env > env.max() * 10 ** (-55 / 20))[0]
    end = min(len(x), above[-1] + int(0.05 * SR), int(keep * SR)); x = x[:end].copy()
    f = int(len(x) * 0.35); x[-f:] *= np.linspace(1, 0, f) ** 2; x[:64] *= np.linspace(0, 1, 64)
    w = min(len(x), 13230); e = np.convolve(x * x, np.ones(w) / w, 'valid').max()
    g = min(10 ** (rms / 20) / np.sqrt(e + 1e-12), 10 ** (-1 / 20) / np.abs(x).max())
    return x * g

def save(name, y):
    p = os.path.join(OUT, name + '.mp3')
    for br in ('96k', '80k', '64k'):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f64le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', br, p], input=y.tobytes(), check=True)
        if os.path.getsize(p) <= 100 * 1024: break
    return os.path.getsize(p)

def banned(s):
    text = (s['name'] + ' ' + ' '.join(s.get('tags') or []) + ' ' + (s.get('description') or '') + ' ' + str(s.get('pack') or '')).lower()
    return any(b in text for b in BANNED)

only = sys.argv[1:]
LIST = open('tools/freesound_list.txt').read().split() if os.path.exists('tools/freesound_list.txt') else None
if LIST or not os.path.exists('tools/freesound_picks.json'):  # step 1: candidates (for the names in tools/freesound_list.txt, or all)
    out = {}
    for name, (queries, dmin, dmax, *_rest) in WANT.items():
        if LIST and name not in LIST: continue
        seen, L = set(), []
        for q in queries:
            for sort in ('score', 'downloads_desc'):
                for s in search(q, dmin, dmax, sort):
                    if s['id'] in seen or banned(s) or not lic_short(s['license'])[0]: continue
                    seen.add(s['id']); L.append({'id': s['id'], 'name': s['name'], 'user': s['username'], 'lic': lic_short(s['license'])[0], 'dur': round(s['duration'], 2),
                        'rating': round(s.get('avg_rating') or 0, 2), 'dl': s.get('num_downloads'), 'tags': (s.get('tags') or [])[:12], 'desc': (s.get('description') or '')[:200], 'q': q})
                time.sleep(0.5)
        out[name] = L; print(name, len(L))
    json.dump(out, open('tools/freesound_candidates.json', 'w'), indent=0, ensure_ascii=False)
    sys.exit(0)

# step 2: the chosen sounds
picks = json.load(open('tools/freesound_picks.json'))
credits = []
for name, ids in picks.items():
    if only and name not in only: continue
    _q, _a, _b, keep, rms, bass = WANT[name]
    for n, sid in enumerate(ids, 1):
        s = api('sounds/%d/' % sid, fields=FIELDS); short = lic_short(s['license'])[0]
        if not short or banned(s): raise SystemExit('not allowed: %d %s' % (sid, s['license']))
        src = os.path.join(TMP, '%d.mp3' % sid); urllib.request.urlretrieve(s['previews']['preview-hq-mp3'], src)
        y = process(load(src), keep, rms, bass); size = save(name + str(n), y)
        credits.append({'file': 'sfx/%s%d.mp3' % (name, n), 'id': sid, 'title': s['name'], 'author': s['username'], 'url': s['url'], 'license': short, 'license_url': s['license'], 'seconds': round(len(y) / SR, 2), 'kb': size // 1024})
        print('%s%d  %-40.40s by %-18.18s %s  %.2fs %d KB' % (name, n, s['name'], s['username'], short, len(y) / SR, size // 1024)); time.sleep(0.5)
json.dump(credits, open('tools/freesound_credits.json', 'w'), indent=1, ensure_ascii=False)
with open('tools/freesound_credits.md', 'w') as f:
    for c in credits:
        f.write('- `%s`: [%s](%s) by **%s**, %s\n' % (c['file'], c['title'].replace(']', ')'), c['url'], c['author'], c['license'] + ('' if c['license'] == 'CC0' else ' ([' + c['license_url'] + '](' + c['license_url'] + '))')))
print(len(credits), 'files')
