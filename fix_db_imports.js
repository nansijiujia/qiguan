const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesDir);

console.log('Fixing database imports in route files...\n');

files.forEach(file => {
  if (file.endsWith('.js')) {
    const filePath = path.join(routesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    const oldImport = /require\(['"]\.\.\/db_mysql['"]\)/g;
    const newImport = "require('../db_unified')";
    
    if (content.match(oldImport)) {
      content = content.replace(oldImport, newImport);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated: ${file}`);
    } else {
      console.log(`⏭️  Skipped: ${file} (no db_mysql import)`);
    }
  }
});

console.log('\n✅ All files processed!');
