import sys,struct,json,io
from PIL import Image
p=sys.argv[1];b=open(p,'rb').read();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);binary=b[28+n:];replacements={}
for im in j.get('images',[]):
 v=j['bufferViews'][im['bufferView']];raw=binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']];pic=Image.open(io.BytesIO(raw));pic.thumbnail((1024,1024),Image.Resampling.LANCZOS);buf=io.BytesIO();pic.save(buf,format='PNG',optimize=True) if pic.mode=='RGBA' and pic.getextrema()[3][0]<255 else pic.convert('RGB').save(buf,format='JPEG',quality=88,optimize=True);data=buf.getvalue();im['mimeType']='image/png' if data[:4]==b'\x89PNG' else 'image/jpeg';replacements[im['bufferView']]=data
chunks=[];offset=0
for i,v in enumerate(j['bufferViews']):
 data=replacements.get(i,binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]);v['byteOffset']=offset;v['byteLength']=len(data);data+=b'\0'*((-len(data))%4);chunks.append(data);offset+=len(data)
j['buffers']=[{'byteLength':offset}];raw=json.dumps(j,separators=(',',':')).encode();raw+=b' '*((-len(raw))%4);open(p,'wb').write(struct.pack('<IIIII',0x46546c67,2,28+len(raw)+offset,len(raw),0x4e4f534a)+raw+struct.pack('<II',offset,0x004e4942)+b''.join(chunks))
