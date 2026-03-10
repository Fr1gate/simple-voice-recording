const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '..', 'node_modules', 'lamejs', 'lame.all.js')

if (!fs.existsSync(file)) {
  console.log('lamejs/lame.all.js not found — skipping patch')
  process.exit(0)
}

const content = fs.readFileSync(file, 'utf-8')

if (content.includes('module.exports')) {
  console.log('lamejs/lame.all.js already patched')
  process.exit(0)
}

fs.appendFileSync(file, '\nmodule.exports = lamejs;\n')
console.log('Patched lamejs/lame.all.js — added module.exports')
