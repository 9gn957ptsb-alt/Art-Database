import sys, json, numpy as np
sys.path.insert(0, '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf5/material/py')
import model5 as M
M.FIX['freq'] = 3.0; M.FIX['freq2'] = 3.0
import eval5
P = json.load(open('refitF3.json'))[0]['p']
res = eval5.evaluate(P, verbose=True)
json.dump(res, open('eval_refitF3.json', 'w'), indent=1)
