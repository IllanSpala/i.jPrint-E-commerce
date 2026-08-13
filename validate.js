import fs from 'fs';
const content = fs.readFileSync('src/data/produtos.js', 'utf8');
const lines = content.split('\n');
let dupes = 0;
// simple regex check for duplicate keys in the same object block (between { and })
// actually, a proper parser is better
