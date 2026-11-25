"""List the narration files in data/audio/<lang>/ into data/audio/index.json, so the app knows which pages have a
recorded voice. Run after adding audio. English narration: Kokoro-82M (Apache-2.0) voice af_heart, via sherpa-onnx."""
import json, os
idx = {}
for lang in ('am', 'en'):
    d = f'data/audio/{lang}'
    idx[lang] = sorted(f[:-4] for f in os.listdir(d) if f.endswith('.m4a')) if os.path.isdir(d) else []
json.dump(idx, open('data/audio/index.json', 'w'), separators=(',', ':'))
print({k: len(v) for k, v in idx.items()})
