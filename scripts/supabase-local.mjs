import { spawnSync } from 'node:child_process';
const action=process.argv[2];
const allowed=new Set(['start','stop','status']);
if(!allowed.has(action)){console.error('Use start, stop or status');process.exit(2);}
const args=['--yes','supabase',action];
const result=spawnSync('npx',args,{stdio:'inherit',shell:process.platform==='win32',env:{...process.env,SUPABASE_ACCESS_TOKEN:''}});
if(result.error){console.error(result.error.message);process.exit(1);}
process.exit(result.status??1);
