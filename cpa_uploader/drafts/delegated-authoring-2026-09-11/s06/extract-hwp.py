from pathlib import Path
import sys,zlib,struct,re,json
D=Path(__file__).parent
sys.path.insert(0,str(D/'tools/python'))
import olefile
for f in (D/'sources').glob('*.hwp'):
 if not olefile.isOleFile(f):print(f.name,'not OLE');continue
 ole=olefile.OleFileIO(f)
 head=ole.openstream('FileHeader').read();compressed=bool(struct.unpack_from('<I',head,36)[0]&1)
 paras=[]
 for stream in sorted(ole.listdir()):
  if stream[0]!='BodyText':continue
  body=ole.openstream(stream).read();body=zlib.decompress(body,-15) if compressed else body
  off=0;n=0
  while off<len(body):
   tag=struct.unpack_from('<I',body,off)[0];off+=4;size=tag>>20
   if size==4095:size=struct.unpack_from('<I',body,off)[0];off+=4
   data=body[off:off+size];off+=size
   if tag&1023!=67:continue
   # Skip 8-unit inline/extended controls; retain textual paragraph content only.
   vals=list(struct.unpack('<'+'H'*(len(data)//2),data[:len(data)//2*2]));out=[];i=0
   while i<len(vals):
    v=vals[i]
    if v in (1,2,3,11,12,14,15,16,17,18,21,22,23):i+=8;continue
    if v in (4,5,6,7,8,9,19,20):
     if v==9:out.append('\t')
     i+=8;continue
    if v in (10,13):out.append('\n')
    elif v>=32:out.append(chr(v))
    i+=1
   text=''.join(out).strip()
   if text:paras.append(text)
 (D/'sources'/f'{f.stem}-text.txt').write_text('\n'.join(paras)+'\n',encoding='utf8')
 print(f.name,len(paras),'text paragraphs')
