const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const listeners = {};
let sent, notice;
const catalog = [{ id:'crc-online-dogs-cats', name:'First Aid for Dogs & Cats', category:'Online Courses' }];
const context = {
  document:{ addEventListener(type,fn){ (listeners[type] ||= []).push(fn); } },
  hero:title=>'<h1>'+title+'</h1>', esc:value=>String(value||''), products:()=>catalog, content:()=>({body:''}), productCard:p=>p.name,
  location:{search:''}, URLSearchParams,
  FormData:class { constructor(form){ this.form=form; } get(key){ return this.form.values[key] || ''; } },
  fetch:async (url,options)=>{ sent=JSON.parse(options.body); return {ok:true}; }, jsonResponse:async()=>({}), setMessage:(id,value)=>{notice=value;}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('catalogue-sections.js','utf8')+'\n'+fs.readFileSync('expansion.js','utf8')+'\nthis.routes=expansionRoutes;',context);
assert.match(context.routes['/online-courses'](), /First Aid for Dogs & Cats/);
const button={disabled:false}, form={id:'online-course-inquiry', values:{course:'crc-online-dogs-cats',language:'English',name:'Customer',email:'customer@valid.ca'}, querySelector:()=>button, reset(){}};
(async()=>{
  for (const handler of listeners.submit) await handler({target:form,preventDefault(){}});
  assert.match(sent.message,/crc-online-dogs-cats/);
  assert.match(sent.message,/English/);
  assert.match(notice,/not yet confirmed/);
  console.log('Online course inquiry checks passed.');
})().catch(error=>{ console.error(error); process.exitCode=1; });
