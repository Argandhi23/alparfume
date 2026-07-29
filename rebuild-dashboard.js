const fs = require('fs');
const lines = fs.readFileSync('src/app/admin/dashboard/page.tsx', 'utf8').split('\n');
lines[16] = lines[16].replace('AdminDashboard', 'DashboardOverview');
let res = [];
let i = 0;
while(i < lines.length) {
  if(lines[i].includes('if (loadingSession) {')) {
    res.push('  return (');
    res.push('    <div className="space-y-6">');
    
    // Skip to Ringkasan Bisnis
    while(i < lines.length && !lines[i].includes('{/* Ringkasan Bisnis */}')) i++;
    
    // Push until Tab Header Start
    while(i < lines.length && !lines[i].includes('{/* Navigation Tabs */}')) {
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

fs.writeFileSync('src/app/admin/(dashboard)/dashboard/page.tsx', res.join('\n'));
