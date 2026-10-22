import sys, json, numpy as np
sys.path.insert(0, '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf5/material/py')
import model5 as M
F = float(sys.argv[1]); seed = int(sys.argv[2]) if len(sys.argv) > 2 else 0
M.FIX['freq'] = F; M.FIX['freq2'] = F
import eval5
P = json.load(open('/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf5/material/py/fit5c.json'))[seed]['p']
res = eval5.evaluate(P, verbose=True)
json.dump(res, open('evalF%.1f_s%d.json' % (F, seed), 'w'), indent=1)
