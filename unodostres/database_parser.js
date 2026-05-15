import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse-fork';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directory where your PDFs are stored
const PDF_DIR = path.join('/home/rares', 'unodostres', 'uni_files');

class TreeNode {
    constructor(id, type, content = null) {
        this.id = id;
        this.type = type; // 'document' or 'paragraph'
        this.content = content;
        this.children = [];
    }
}

async function parsePDFs() {
    const root = new TreeNode('root', 'root');
    let paragraphIdCounter = 1;

    try {
        if (!fs.existsSync(PDF_DIR)) {
            console.error(`Directory not found: ${PDF_DIR}`);
            return null;
        }

        const files = fs.readdirSync(PDF_DIR).filter(file => file.toLowerCase().endsWith('.pdf'));
        
        if (files.length === 0) {
            console.log('No PDF files found in the directory.');
            return null;
        }

        for (const file of files) {
            console.log(`Parsing: ${file}...`);
            const filePath = path.join(PDF_DIR, file);
            const dataBuffer = fs.readFileSync(filePath);
            
            try {
                const data = await pdf(dataBuffer);
                const text = data.text;
                
                // Split text by double newlines or multiple newlines to isolate paragraphs
                const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 10);
                
                const fileNode = new TreeNode(`doc_${file}`, 'document');
                root.children.push(fileNode);
                
                paragraphs.forEach((para) => {
                    fileNode.children.push(new TreeNode(`para_${paragraphIdCounter++}`, 'paragraph', para));
                });
            } catch (err) {
                console.error(`Error parsing file ${file}:`, err);
            }
        }

        console.log('Successfully parsed all PDFs into a tree structure.');
        return root;
    } catch (error) {
        console.error('Error in parsePDFs:', error);
        return null;
    }
}

// Check if run directly
const isMain = process.argv[1] === __filename || process.argv[1].endsWith('database_parser.js');
if (isMain) {
    parsePDFs().then(tree => {
        if (tree) {
            const outPath = path.join(__dirname, 'knowledge-tree.json');
            fs.writeFileSync(outPath, JSON.stringify(tree, null, 2));
            console.log(`Knowledge tree saved to ${outPath}`);
        }
    });
}

export { parsePDFs };