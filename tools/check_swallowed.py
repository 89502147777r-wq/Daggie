# Finds lines where a // comment is followed by more code on the same line (the code after it never runs).
# Usage: python3 tools/check_swallowed.py [file ...]   (default: run-engine.js). Exit code 1 if something is found.
import re, sys
bad = 0
PROSE = ("flock mode is switched off", "snapped: falls flat", "follow the body; while", "pose helpers: a pose is", "the race car takes damage", "4b. speed bumps across the road", "bright hot head at the bottom", "(3 = the number of stair levels", "Each is turned to fire along -z")  # known comments that only read like code
for f in sys.argv[1:] or ['run-engine.js']:
    for n, line in enumerate(open(f, encoding='utf-8'), 1):
        for m in re.finditer(r'(?<![:\'"\\])//', line):
            before = line[:m.start()]
            if before.count("'") % 2 or before.count('"') % 2 or before.count('`') % 2: continue  # inside a string
            after = line[m.end():]
            if after.strip().startswith(PROSE): continue
            if re.search(r';\s*(const|let|var|if|for|while|return|[A-Za-z_$][\w.$]*\s*\(|[A-Za-z_$][\w.$\[\]]*\s*[+\-*/]?=)', after) or re.search(r'[\w)\]]\s*=\s*[\w.(\[-][^;]*;|\}\s*$|\)\s*;\s*$', after):
                print('%s:%d: code after a // comment: %s' % (f, n, after.strip()[:100])); bad += 1; break
sys.exit(1 if bad else 0)
