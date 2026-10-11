# Download 3D models from Sketchfab (CC BY / CC0 only) with the repository secret SKETCHFAB_API_TOKEN,
# convert them to compact .glb files (WebP textures <= 1024 px, no Draco) and write models/info.json for CREDITS.md.
# Runs in GitHub Actions (.github/workflows/sketchfab-models.yml). Picks: tools/sketchfab_picks.json {name: uid}.
import json, os, subprocess, sys, urllib.request, zipfile, glob, shutil
TOKEN = os.environ['SKETCHFAB_API_TOKEN']
OK = ('CC Attribution', 'CC0', 'Public Domain')
picks = json.load(open('tools/sketchfab_picks.json'))
os.makedirs('models', exist_ok=True)
def get(url, auth=True):
    req = urllib.request.Request(url, headers={'Authorization': 'Token ' + TOKEN} if auth else {})
    with urllib.request.urlopen(req, timeout=60) as r: return json.load(r)
info = json.load(open('models/info.json')) if os.path.exists('models/info.json') else {}
for name, cfg in picks.items():
    uid = cfg['uid']; ratio = cfg.get('simplify', 0)
    m = get('https://api.sketchfab.com/v3/models/' + uid, auth=False); lic = (m.get('license') or {}).get('label', '')
    if not lic.startswith(OK) or 'NonCommercial' in lic or 'NoDerivs' in lic: raise SystemExit('licence not allowed: %s %s' % (name, lic))
    d = get('https://api.sketchfab.com/v3/models/%s/download' % uid); url = d['gltf']['url']
    work = '/tmp/sf/' + name; shutil.rmtree(work, ignore_errors=True); os.makedirs(work)
    urllib.request.urlretrieve(url, work + '/m.zip'); zipfile.ZipFile(work + '/m.zip').extractall(work)
    src = (glob.glob(work + '/**/scene.gltf', recursive=True) or glob.glob(work + '/**/*.gltf', recursive=True) or glob.glob(work + '/**/*.glb', recursive=True))[0]
    out = 'models/%s.glb' % name
    cmd = ['npx', '--yes', '@gltf-transform/cli@4.1.1', 'optimize', src, out, '--compress', 'false', '--texture-compress', 'webp', '--texture-size', '1024', '--instance', 'false']
    if ratio: cmd += ['--simplify-ratio', str(ratio), '--simplify-error', '0.002']
    else: cmd += ['--simplify', 'false']
    subprocess.run(cmd, check=True)
    insp = subprocess.run(['npx', '--yes', '@gltf-transform/cli@4.1.1', 'inspect', out, '--format', 'md'], capture_output=True, text=True).stdout
    open('models/%s.inspect.md' % name, 'w').write(insp)
    info[name] = {'uid': uid, 'title': m['name'], 'author': m['user']['username'], 'author_name': m['user'].get('displayName'), 'url': m['viewerUrl'], 'license': lic,
                  'license_url': (m.get('license') or {}).get('url'), 'faces': m.get('faceCount'), 'kb': os.path.getsize(out) // 1024}
    print(name, info[name])
json.dump(info, open('models/info.json', 'w'), indent=1, ensure_ascii=False)
