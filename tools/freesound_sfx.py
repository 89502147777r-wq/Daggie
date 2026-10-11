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
WANT = {
    'cannon':   (['cannon fire', 'cannon shot'], 0.8, 8, 2.4, -11, 4),
    'glass':    (['glass shatter', 'glass smash'], 0.4, 5, 2.0, -14, 0),
    'window':   (['window break', 'window smash'], 0.4, 5, 2.0, -14, 0),
    'wood':     (['wood break', 'wood crack impact'], 0.3, 4, 1.4, -14, 3),
    'hay':      (['hay bale impact', 'straw impact'], 0.3, 4, 1.2, -17, 0),
    'brick':    (['brick wall collapse', 'bricks falling'], 0.5, 6, 2.0, -14, 4),
    'stone':    (['rock impact', 'stone smash'], 0.3, 5, 1.8, -14, 4),
    'ice':      (['ice break', 'ice shatter'], 0.3, 5, 1.6, -14, 0),
    'metal':    (['metal impact', 'metal hit heavy'], 0.3, 4, 1.6, -14, 2),
    'vault':    (['heavy metal door slam', 'vault door slam'], 0.5, 6, 2.4, -12, 5),
    'rip':      (['metal tear', 'metal rip'], 0.3, 4, 1.4, -14, 0),
    'thud':     (['body fall thud', 'heavy thud'], 0.2, 3, 0.8, -15, 5),
    'truck':    (['truck crash', 'heavy metal crash'], 0.6, 6, 2.2, -12, 5),
    'car':      (['car crash', 'car impact'], 0.6, 6, 2.2, -12, 4),
    'tires':    (['tire impact', 'rubber thud'], 0.2, 3, 0.9, -15, 5),
    'sand':     (['sand pour', 'sand falling'], 0.5, 6, 1.6, -18, 0),
    'body':     (['robot impact', 'metal body hit'], 0.2, 3, 1.0, -15, 3),
    'creak':    (['metal creak', 'metal groan'], 0.5, 5, 1.6, -17, 0),
    'hdboom':   (['cinematic boom', 'cinematic impact sub'], 1.0, 8, 3.2, -9, 4),
    'hdwhoosh': (['heavy whoosh', 'swing whoosh'], 0.4, 4, 2.0, -14, 0),
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

def search(query, dmin, dmax):
    lic = ' OR '.join('"%s"' % k for k in LICENSES)
    r = api('search/text/', query=query, filter='license:(%s) duration:[%s TO %s]' % (lic, dmin, dmax), sort='downloads_desc', page_size=30,
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

credits, used = [], set()
only = sys.argv[1:]
for name, (queries, dmin, dmax, keep, rms, bass) in WANT.items():
    if only and name not in only: continue
    print('==', name)
    cands = []
    for q in queries:
        for s in search(q, dmin, dmax):
            text = (s['name'] + ' ' + ' '.join(s.get('tags') or []) + ' ' + (s.get('description') or '') + ' ' + str(s.get('pack') or '')).lower()
            if s['id'] in used or any(b in text for b in BANNED): continue
            short, lic = lic_short(s['license'])
            if not short: continue
            s['_lic'] = short; cands.append(s)
        time.sleep(1)
    cands.sort(key=lambda s: (-(s.get('avg_rating') or 0) * min(1, (s.get('num_downloads') or 0) / 500), -(s.get('num_downloads') or 0)))
    n, users = 0, {}
    for s in cands:
        if n >= PER_NAME: break
        if users.get(s['username'], 0) >= 2: continue  # some variety between recordists
        src = os.path.join(TMP, '%d.mp3' % s['id'])
        try: urllib.request.urlretrieve(s['previews']['preview-hq-mp3'], src)
        except Exception as e: print('  skip', s['id'], e); continue
        y = process(load(src), keep, rms, bass)
        if y is None or len(y) < 0.12 * SR: continue
        n += 1; used.add(s['id']); users[s['username']] = users.get(s['username'], 0) + 1
        size = save(name + str(n), y)
        credits.append({'file': 'sfx/%s%d.mp3' % (name, n), 'title': s['name'], 'author': s['username'], 'url': s['url'], 'license': s['_lic'], 'license_url': s['license'],
                        'rating': s.get('avg_rating'), 'downloads': s.get('num_downloads'), 'seconds': round(len(y) / SR, 2), 'kb': size // 1024})
        print('  %s%d  %-40.40s by %-18.18s %s  %.2fs %d KB' % (name, n, s['name'], s['username'], s['_lic'], len(y) / SR, size // 1024))
    if n == 0: print('  nothing found: the OpenGameArt files stay')

json.dump(credits, open('tools/freesound_credits.json', 'w'), indent=1, ensure_ascii=False)
with open('tools/freesound_credits.md', 'w') as f:
    for c in credits:
        f.write('- `%s`: [%s](%s) by **%s**, %s\n' % (c['file'], c['title'].replace(']', ')'), c['url'], c['author'], c['license'] + ('' if c['license'] == 'CC0' else ' ([' + c['license_url'] + '](' + c['license_url'] + '))')))
print(len(credits), 'files')
