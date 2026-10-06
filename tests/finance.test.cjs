const fs = require('fs');
const path = require('path');
const vm = require('vm');
const srcPath = path.join(__dirname, '..', 'assets', 'app.js');
const src = fs.readFileSync(srcPath, 'utf8');
const start = src.indexOf('function normalizeMinor');
const end = src.indexOf('async function setupPassword()', start);
const balStart = src.indexOf('let financialSnapshotCache=null;');
const balEnd = src.indexOf('function categoryName', balStart);
const code = src.slice(start, end) + src.slice(balStart, balEnd);
const sandbox = {state:null, console, uuid:()=>`id-${Math.random()}`};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
function makeState(accounts, transactions){ sandbox.state={accounts,transactions}; sandbox.invalidateFinancialSnapshot(); }
function assert(cond,msg){ if(!cond) throw new Error(msg); }
const normalized=sandbox.normalizeAccounts([
  {id:'cash-old',name:'Cash',type:'Cash',openingMinor:650000,archived:false},
  {id:'cash-new',name:'Cash',type:'Cash',openingMinor:0,archived:false}
]);
assert(normalized.length===2,'Duplicate Cash accounts were merged.');
assert(normalized.find(a=>a.id==='cash-new').openingMinor===0,'New zero account inherited opening money.');
makeState([
  {id:'a',name:'Cash',type:'Cash',openingMinor:100000,archived:false},
  {id:'b',name:'Bank',type:'Bank',openingMinor:50000,archived:false}
],[
  {id:'i',type:'income',amountMinor:25000,accountId:'a',toAccountId:''},
  {id:'e',type:'expense',amountMinor:5000,accountId:'a',toAccountId:''},
  {id:'t',type:'transfer',amountMinor:20000,accountId:'a',toAccountId:'b'}
]);
assert(sandbox.balanceForAccount('a')===100000,'Cash balance calculation failed.');
assert(sandbox.balanceForAccount('b')===70000,'Bank balance calculation failed.');
assert(sandbox.totalBalance()===170000,'Total balance calculation failed.');
makeState([{id:'a',name:'Cash',type:'Cash',openingMinor:0,archived:false}],[
  {id:'e',type:'expense',amountMinor:-6000,accountId:'a',toAccountId:'',date:'2026-10-06'},
  {id:'i',type:'income',amountMinor:-10000,accountId:'a',toAccountId:'',date:'2026-10-06'}
]);
assert(sandbox.balanceForAccount('a')===4000,'Negative stored amounts corrupted balance sign handling.');
const pt=sandbox.periodTotals('2026-10-01','2026-10-31');
assert(pt.income===10000 && pt.expense===6000,'Period totals do not normalize monetary magnitudes.');
const normalizedState=sandbox.normalizeTransactions([{id:'x',type:'income',amountMinor:600000,accountId:'missing'}],[{id:'a',name:'Cash',type:'Cash',openingMinor:0}],{defaultAccountId:'a'});
assert(normalizedState[0].accountId==='a','Orphan transaction was not assigned to fallback account.');
makeState([{id:'a',name:'A',type:'Other',openingMinor:70000},{id:'b',name:'B',type:'Other',openingMinor:30000}],[{id:'t',type:'transfer',amountMinor:45000,accountId:'a',toAccountId:'b'}]);
assert(sandbox.totalBalance()===100000,'Transfer changed total money.');
makeState([{id:'a',name:'Archived Bank',type:'Bank',openingMinor:120000,archived:true},{id:'b',name:'Cash',type:'Cash',openingMinor:30000,archived:false}],[]);
assert(sandbox.totalBalance()===150000,'Archived account balance disappeared from total money.');
process.stdout.write('FINANCE_TESTS_PASS\n');
