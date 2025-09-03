const { analyzeSimilarityScores } = require('../src/lib/qdrant');

// Test queries to analyze similarity score distributions
const testQueries = [
    "what is pneumothorax?",
    "how to treat asthma?",
    "lung cancer symptoms",
    "COPD diagnosis",
    "pulmonary embolism treatment"
];

async function analyzeQueries() {
    console.log('🔍 Analyzing similarity scores for test queries...\n');
    
    for (const query of testQueries) {
        try {
            console.log(`📝 Query: "${query}"`);
            const analysis = await analyzeSimilarityScores(query, { limit: 20 });
            
            const { scores, statistics } = analysis;
            
            console.log(`   Score Range: ${statistics.min.toFixed(3)} to ${statistics.max.toFixed(3)}`);
            console.log(`   Mean Score: ${statistics.mean.toFixed(3)}`);
            console.log(`   Median Score: ${statistics.median.toFixed(3)}`);
            console.log(`   Recommended Threshold: ${statistics.recommendedThreshold.toFixed(3)}`);
            console.log(`   Top 5 Scores: ${scores.slice(0, 5).map(s => s.toFixed(3)).join(', ')}`);
            console.log(`   Sources above 0.1: ${scores.filter(s => s >= 0.1).length}`);
            console.log(`   Sources above 0.2: ${scores.filter(s => s >= 0.2).length}`);
            console.log(`   Sources above 0.3: ${scores.filter(s => s >= 0.3).length}`);
            console.log('');
            
        } catch (error) {
            console.error(`❌ Error analyzing query "${query}":`, error.message);
        }
    }
    
    console.log('💡 Recommendations:');
    console.log('   - If most scores are below 0.2, try lowering your threshold to 0.1');
    console.log('   - If you want more context, increase Top-K to 15-20');
    console.log('   - Use the "Analyze Query Scores" button in the UI for real-time analysis');
}

// Run the analysis
analyzeQueries().catch(console.error);
