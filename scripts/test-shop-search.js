const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const listeners = {};
const elements = { 'shop-search':{ value:'' }, 'shop-category':{ value:'' }, 'shop-results':{ innerHTML:'' } };
const catalog = [
  { name:'Lifeline AED', category:'AED Sales', description:'Defibrillator' },
  { name:'BZK Antiseptic', category:'First aid kits', description:'Towelette' },
  { name:'PRESTAN Adult', category:'PRESTAN Equipment', description:'Manikin' }
];
const context = { document:{ addEventListener(name, cb){ listeners[name] = cb; }, getElementById(id){ return elements[id]; } }, products:() => catalog, productCard:p => `<article>${p.name}</article>`, location:{search:''}, URLSearchParams, esc:String, hero:() => '' };
vm.createContext(context);
vm.runInContext(fs.readFileSync('catalogue-sections.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('expansion.js', 'utf8'), context);
elements['shop-search'].value = 'antiseptic';
listeners.input({ target:{ id:'shop-search' } });
assert.match(elements['shop-results'].innerHTML, /BZK Antiseptic/);
assert.doesNotMatch(elements['shop-results'].innerHTML, /Lifeline AED/);
elements['shop-search'].value = '';
elements['shop-category'].value = 'PRESTAN Equipment';
listeners.input({ target:{ id:'shop-category' } });
assert.match(elements['shop-results'].innerHTML, /PRESTAN Adult/);
assert.doesNotMatch(elements['shop-results'].innerHTML, /BZK Antiseptic/);
console.log('Equipment search and filter checks passed.');
