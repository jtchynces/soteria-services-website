const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const listeners = {};
let sent, message;
const context = {
  document:{ addEventListener(type,fn){ (listeners[type] ||= []).push(fn); } },
  hero:title=>'<h1>'+title+'</h1>', esc:value=>String(value||''), products:()=>[], content:()=>({body:''}),
  location:{search:''}, URLSearchParams,
  FormData:class { constructor(form){ this.form=form; } get(key){ return this.form.values[key] || ''; } getAll(key){ return this.form.values[key] || []; } },
  fetch:async (url,options)=>{ sent=JSON.parse(options.body); return {ok:true}; }, jsonResponse:async()=>({}), setMessage:(id,value)=>{message=value;}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('expansion.js','utf8')+'\nthis.routes=expansionRoutes;',context);
const ready = context.routes['/soteria-ready']();
for (const name of ['Bronze','Silver','Gold','Complete','Fire extinguishers','Naloxone kits','Emergency preparedness review']) assert.match(ready,new RegExp(name,'i'));
assert.doesNotMatch(ready,/\$\d/);
const crc = fs.readFileSync('supabase/migrations/011_crc_reference_drafts.sql','utf8');
assert.equal((crc.match(/'Online Courses','/g)||[]).length,16);
assert.equal((crc.match(/'Training Materials','/g)||[]).length,26);
assert.match(crc, /'request_quote', false/);
assert.match(crc, /on conflict \(id\) do nothing/i);
const button={disabled:false}, form={id:'ready-inquiry', values:{tier:'Complete',aeds:'2',kits:'3',buildings:'1',locations:'1',location:'Chatham',name:'Customer',email:'customer@valid.ca',equipment:['Oxygen kits','Exit maps']}, querySelector:()=>button, reset(){}};
(async()=>{
  for (const handler of listeners.submit) await handler({target:form,preventDefault(){}});
  assert.equal(sent.serviceInterest,'Soteria Ready');
  assert.match(sent.message,/Complete/);
  assert.match(sent.message,/Oxygen kits, Exit maps/);
  assert.match(message,/received/);
  console.log('Soteria Ready and CRC reference checks passed.');
})().catch(error=>{ console.error(error); process.exitCode=1; });
