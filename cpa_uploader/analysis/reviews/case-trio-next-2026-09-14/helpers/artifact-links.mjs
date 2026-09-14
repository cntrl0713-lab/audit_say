import fs from 'node:fs';
import path from 'node:path';

export function checkArtifactLinks(file){
 const broken=[];let links=0;
 for(const match of fs.readFileSync(file,'utf8').matchAll(/(?<!!)\[[^\]\r\n]*\]\((<[^>\r\n]+>|[^)\r\n]+)\)/gu)){
  let target=match[1].trim();
  if(target.startsWith('<')&&target.endsWith('>'))target=target.slice(1,-1);
  if(/^(https?:|#|mailto:)/iu.test(target))continue;
  target=target.split('#')[0];links++;
  try{
   const decoded=decodeURIComponent(target).replace(/:\d+$/u,'');
   if(!fs.existsSync(path.resolve(path.dirname(file),decoded)))broken.push({file,target});
  }catch{broken.push({file,target,reason:'invalid_uri_encoding'});}
 }
 return {links,broken};
}
