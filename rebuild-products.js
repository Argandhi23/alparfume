const fs = require('fs');
const lines = fs.readFileSync('src/app/admin/dashboard/page.tsx', 'utf8').split('\n');
lines[16] = lines[16].replace('AdminDashboard', 'ProductsPage');
let res = [];
let i = 0;
while(i < lines.length) {
  if(lines[i].includes('if (loadingSession) {')) {
    res.push('  const activeTab = "products";');
    res.push('  return (');
    res.push('    <div className="space-y-6 p-6 md:p-8 max-w-7xl mx-auto">');
    
    // Skip to Tab content 1
    while(i < lines.length && !lines[i].includes('{/* Tab content 1: Manage Products */}')) i++;
    
    // Push until Tab content 2
    while(i < lines.length && !lines[i].includes('{/* Tab content 2: Order Intents History */}')) {
      res.push(lines[i]);
      i++;
    }
    
    // Skip to Modals
    while(i < lines.length && !lines[i].includes('{/* DELETE CONFIRMATION MODAL */}')) i++;
    
    // Push Modals for products
    while(i < lines.length && !lines[i].includes('{/* ACCOUNT SETTINGS MODAL */}')) {
      res.push(lines[i]);
      i++;
    }
    
    res.push('    </div>');
    res.push('  );');
    res.push('}');
    
    break; // Done with the component structure
  }
  res.push(lines[i]);
  i++;
}

fs.writeFileSync('src/app/admin/(dashboard)/products/page.tsx', res.join('\n'));
