function replaceColors() {
  const fs = require('fs');
  const path = require('path');

  const dir = path.join(__dirname, 'src');

  function processDir(directory) {
    const files = fs.readdirSync(directory);
    for (const file of files) {
      const fullPath = path.join(directory, file);
      if (fs.statSync(fullPath).isDirectory()) {
        processDir(fullPath);
      } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
        let content = fs.readFileSync(fullPath, 'utf8');
        let newContent = content
          .replace(/text-white\/30/g, 'text-ui-muted')
          .replace(/text-white\/40/g, 'text-ui-muted')
          .replace(/text-white\/50/g, 'text-ui-muted')
          .replace(/text-white\/60/g, 'text-ui-muted')
          .replace(/text-white\/70/g, 'text-ui-muted')
          .replace(/text-white\/80/g, 'text-ui-text')
          .replace(/text-white(?![\/\-\w])/g, 'text-ui-text')
          .replace(/bg-white\/5(?![\/\-\w])/g, 'bg-ui-surface')
          .replace(/bg-white\/10(?![\/\-\w])/g, 'bg-ui-surface-hover')
          .replace(/bg-white\/20(?![\/\-\w])/g, 'bg-ui-surface-hover')
          .replace(/border-white\/10(?![\/\-\w])/g, 'border-ui-border')
          .replace(/border-white\/5(?![\/\-\w])/g, 'border-ui-border')
          .replace(/bg-indigo-600(?![\/\-\w])/g, 'bg-primary')
          .replace(/bg-indigo-500(?![\/\-\w])/g, 'bg-primary-hover')
          .replace(/text-indigo-400(?![\/\-\w])/g, 'text-primary')
          .replace(/text-indigo-300(?![\/\-\w])/g, 'text-primary')
          .replace(/text-indigo-500(?![\/\-\w])/g, 'text-primary-hover')
          .replace(/border-indigo-500(?![\/\-\w])/g, 'border-primary')
          .replace(/border-indigo-500\/30/g, 'border-primary/30')
          .replace(/border-indigo-500\/20/g, 'border-primary/20')
          .replace(/bg-indigo-500\/20/g, 'bg-primary/20')
          .replace(/bg-indigo-500\/10/g, 'bg-primary/10')
          .replace(/bg-indigo-600\/50/g, 'bg-primary/50');
        
        fs.writeFileSync(fullPath, newContent, 'utf8');
      }
    }
  }

  processDir(dir);
  console.log('Replaced colors in source files');
}

replaceColors();
