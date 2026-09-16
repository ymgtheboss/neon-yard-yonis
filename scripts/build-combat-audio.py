"""Prepare compact mono firearm clips from the CC0 Prepared SFX Library.
Usage: python3 scripts/build-combat-audio.py /path/to/extracted/sources
See public/audio/CREDITS.txt for download URLs. No runtime audio dependencies.
"""
import array, json, math, pathlib, shutil, sys, wave
source = pathlib.Path(sys.argv[1])
out = pathlib.Path(__file__).resolve().parents[1] / 'public/audio'
out.mkdir(parents=True, exist_ok=True)
shots = {
 'pistol':('Walther PPQ/X_39P.wav', .85), 'rifle':('AK-47/C_28P.wav', 1.05),
 'shotgun':('Mossberg/N_30P.wav', 1.4), 'sniper':('Tikka/W_29P.wav', 1.7),
 'revolver':('Smith & Wesson 642/V_27P.wav', 1.25), 'lmg':('AK-47/C_31P.wav', 1.1),
 'dmr':('SKS/U_14P.wav', 1.25), 'carbine':('AR-15/D_32P.wav', 1.0),
 'autoshot':('Nova/O_21P.wav', 1.25), 'smg':('Carl Gustav M45/G_31P.wav', .8)
}
manifest = {}
for gun, (name, duration) in shots.items():
 with wave.open(str(source/'Prepared SFX Library'/name)) as w:
  rate, width, channels = w.getframerate(), w.getsampwidth(), w.getnchannels()
  raw = w.readframes(w.getnframes())
 stride=width*channels
 samples=[sum(int.from_bytes(raw[i+c*width:i+(c+1)*width], 'little', signed=True) for c in range(channels))/channels for i in range(0,len(raw),stride)]
 peak=max(map(abs,samples))
 onset=next(i for i,x in enumerate(samples) if abs(x)>peak*.25)
 start=max(0,onset-int(rate*.004));samples=samples[start:start+int(rate*duration)]
 # Windowed-sinc low-pass before 96 kHz → 32 kHz decimation.
 assert rate==96000
 taps=[]
 for j in range(-15,16):
  sinc=.30 if j==0 else math.sin(math.pi*.30*j)/(math.pi*j)
  taps.append(sinc*(.54+.46*math.cos(math.pi*j/15)))
 norm=sum(taps);taps=[v/norm for v in taps]
 reduced=[sum(samples[min(len(samples)-1,max(0,i+j-15))]*t for j,t in enumerate(taps)) for i in range(0,len(samples),3)]
 gain=28000/max(map(abs,reduced))
 data=array.array('h',(int(x*gain*min(1,i/24,(len(reduced)-1-i)/2200)) for i,x in enumerate(reduced)))
 if sys.byteorder!='little':data.byteswap()
 with wave.open(str(out/(gun+'.wav')),'wb') as w:w.setparams((1,2,32000,len(data),'NONE','not compressed'));w.writeframes(data.tobytes())
 manifest[gun]={'source':name,'trimStart':round(start/rate,4),'duration':len(data)/32000}
for kind in ['concrete','wood','snow','grass']:
 for i in range(3):shutil.copyfile(source/'Audio'/f'footstep_{kind}_{i:03}.ogg',out/f'{kind}-{i}.ogg')
for name in ['clipload2','singlebullet1']:shutil.copyfile(source/(name+'.wav'),out/(name+'.wav'))
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Prepared',len(shots),'firearm clips and 14 foley clips:',sum(p.stat().st_size for p in out.iterdir()),'bytes')
