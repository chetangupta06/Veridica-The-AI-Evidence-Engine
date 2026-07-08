const fs = require('fs'); 
const text = fs.readFileSync('C:/Users/cheta/.gemini/antigravity/brain/146aeb7c-48f7-436b-a65c-0d63b05fc047/.system_generated/steps/778/content.md', 'utf8');
const regex = /href="([^"]+)"[^>]*>.*?Available Models/is;
const matches = text.match(regex);
console.log(matches ? matches[1] : 'none');
