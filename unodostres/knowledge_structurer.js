import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_PATH = path.join(__dirname, 'knowledge-tree.json');
const OUTPUT_PATH = path.join(__dirname, 'optimized-knowledge-base.json');

// Basic Romanian Stop Words & Helpers
const STOP_WORDS = new Set(['de', 'la', 'un', 'o', 'și', 'cu', 'în', 'din', 'pe', 'că', 'să', 'le', 'îi', 'al', 'ai', 'ale', 'lor']);
const VERB_ENDINGS = ['escu', 'ează', 'ează', 'ă', 'esc', 'im', 'iți', 'esc', 'at', 'ut', 'it'];

class SyntacticNode {
    constructor(word, role = 'unknown') {
        this.word = word;
        this.lemma = this.lemmatize(word);
        this.role = role; // Subject, Verb, Object, Modifier
        this.children = [];
    }

    // Very basic Romanian lemmatizer/stemmer logic
    lemmatize(word) {
        let lemma = word.toLowerCase().replace(/[.,!?;:]/g, '');
        // Basic reduction of plural/inflected forms (very simplified for banking context)
        if (lemma.endsWith('ile') || lemma.endsWith('ilor')) return lemma.slice(0, -3);
        if (lemma.endsWith('ul') || lemma.endsWith('ea')) return lemma.slice(0, -2);
        return lemma;
    }
}

function buildSentenceTree(sentence) {
    const words = sentence.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return null;

    // Create a horizontal syntactic chain (Left to Right)
    // In a more complex version, we would find the Verb as root.
    // Here we build a tree where each word points to the next to preserve syntax.
    let head = new SyntacticNode(words[0]);
    let current = head;

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const role = determineRole(word, words[i-1]);
        const newNode = new SyntacticNode(word, role);
        current.children.push(newNode);
        current = newNode;
    }

    return head;
}

function determineRole(word, prevWord) {
    const w = word.toLowerCase();
    if (STOP_WORDS.has(w)) return 'separator';
    if (VERB_ENDINGS.some(e => w.endsWith(e))) return 'action';
    if (w.length > 5) return 'entity'; // Likely a noun/concept in banking
    return 'modifier';
}

async function structureKnowledge() {
    if (!fs.existsSync(INPUT_PATH)) {
        console.error('knowledge-tree.json not found. Run database_parser.js first.');
        return;
    }

    console.log('Starting Semantic Structuring...');
    const rawTree = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
    const optimizedTree = {
        timestamp: new Date().toISOString(),
        root: {
            id: 'optimized_root',
            documents: []
        }
    };

    for (const doc of rawTree.children) {
        console.log(`Structuring document: ${doc.id}...`);
        const docNode = {
            id: doc.id,
            paragraphs: []
        };

        for (const para of doc.children) {
            const sentences = para.content.split(/[.!?]\s+/);
            const paraNode = {
                id: para.id,
                original_text: para.content,
                sentence_trees: sentences.map(s => buildSentenceTree(s)).filter(t => t !== null)
            };
            docNode.paragraphs.push(paraNode);
        }
        optimizedTree.root.documents.push(docNode);
    }

    // Flatten all paragraphs into a single list for even distribution
    const allParagraphs = [];
    for (const doc of optimizedTree.root.documents) {
        for (const para of doc.paragraphs) {
            allParagraphs.push({
                docId: doc.id,
                ...para
            });
        }
    }

    const totalParas = allParagraphs.length;
    const numFiles = 10;
    const parasPerFile = Math.ceil(totalParas / numFiles);

    console.log(`Total paragraphs: ${totalParas}. Splitting into ${numFiles} files (~${parasPerFile} per file)...`);

    for (let i = 0; i < numFiles; i++) {
        const start = i * parasPerFile;
        const end = Math.min(start + parasPerFile, totalParas);
        const chunk = {
            timestamp: optimizedTree.timestamp,
            part: i + 1,
            total_parts: numFiles,
            paragraphs: allParagraphs.slice(start, end)
        };

        if (chunk.paragraphs.length > 0) {
            const chunkPath = path.join(__dirname, `optimized-knowledge-part-${i + 1}.json`);
            // Minified JSON (no spaces or newlines)
            fs.writeFileSync(chunkPath, JSON.stringify(chunk));
            console.log(`Saved minified part ${i + 1} (${chunk.paragraphs.length} paragraphs) to ${chunkPath}`);
        }
    }
}

const isMain = process.argv[1] === __filename || process.argv[1].endsWith('knowledge_structurer.js');
if (isMain) {
    structureKnowledge();
}

export { structureKnowledge };