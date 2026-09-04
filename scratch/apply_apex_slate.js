const fs = require('fs');
const path = require('path');

const indexPath = path.resolve('c:/Users/Mnavares/Documents/CCTV OPS/audit-report/index.html');
const apexPath = path.resolve('c:/Users/Mnavares/Documents/CCTV OPS/audit-report/scratch/apex_slate_complete.css');

let indexHtml = fs.readFileSync(indexPath, 'utf8');
const apexCss = fs.readFileSync(apexPath, 'utf8');

const targetStart = '<style id="opsUiUxPolishV9">';
const startIndex = indexHtml.indexOf(targetStart);
if (startIndex === -1) {
    console.error("Could not find targetStart in index.html");
    process.exit(1);
}

const headIndex = indexHtml.indexOf('</head>', startIndex);
if (headIndex === -1) {
    console.error("Could not find </head> in index.html");
    process.exit(1);
}

const styleEndTag = '</style>';
const lastStyleIndex = indexHtml.lastIndexOf(styleEndTag, headIndex);
if (lastStyleIndex === -1 || lastStyleIndex < startIndex) {
    console.error("Could not find preceding </style> before </head>");
    process.exit(1);
}

const before = indexHtml.slice(0, startIndex);
const after = indexHtml.slice(lastStyleIndex + styleEndTag.length);

const newIndexHtml = before + apexCss + after;

fs.writeFileSync(indexPath, newIndexHtml, 'utf8');
console.log("Successfully applied Apex Slate styling to index.html!");
