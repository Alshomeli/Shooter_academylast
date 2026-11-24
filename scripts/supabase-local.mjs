import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const action=process.argv[2];
const allowed=new Set(['start','stop','status','check']);
if(!allowed.has(action)){console.error('Use check, start, stop or status');process.exit(2);}
if(existsSync('supabase/.temp/project-ref')){
 console.error('Remote Supabase link detected. Remove the local link manually before using this sandbox.');
 process.exit(2);
}
function command(binary,args){
 const result=spawnSync(binary,args,{stdio:'inherit',shell:process.platform==='win32',
  env:{...process.env,SUPABASE_ACCESS_TOKEN:''}});
 if(result.error){console.error(result.error.message);process.exit(1);}
 if(result.status!==0)process.exit(result.status??1);
}
if(action==='check'||action==='start'){
 command('docker',['info','--format','{{.ServerVersion}}']);
 if(action==='check'){console.log('Local Docker daemon available. No linked Supabase project found.');process.exit(0);}
}
command('npx',['--yes','supabase',action]);
