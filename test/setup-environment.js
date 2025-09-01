#!/usr/bin/env node

/**
 * Environment Setup Script
 * 
 * This script helps you configure your environment variables for the chatbot.
 * It will create a proper .env.local file with your actual credentials.
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Environment Setup for Enhanced Chatbot\n');

// Check if .env.local exists
const envPath = path.join(process.cwd(), '.env.local');
const envExists = fs.existsSync(envPath);

if (envExists) {
    console.log('📁 Found existing .env.local file');
    const currentEnv = fs.readFileSync(envPath, 'utf8');
    
    // Check for placeholder values
    const hasPlaceholders = currentEnv.includes('your_') || currentEnv.includes('placeholder');
    
    if (hasPlaceholders) {
        console.log('⚠️  Found placeholder values in .env.local');
        console.log('💡 You need to replace these with your actual credentials\n');
        
        console.log('📋 Required Environment Variables:');
        console.log('1. QDRANT_URL - Your Qdrant Cloud cluster URL');
        console.log('2. QDRANT_API_KEY - Your Qdrant Cloud API key');
        console.log('3. GOOGLE_GENERATIVE_AI_API_KEY - Your Google AI API key');
        console.log('4. NEXT_PUBLIC_SUPABASE_URL - Your Supabase project URL (optional)');
        console.log('5. SUPABASE_ANON_KEY - Your Supabase anon key (optional)\n');
        
        console.log('🔗 Get your credentials from:');
        console.log('- Qdrant Cloud: https://cloud.qdrant.io');
        console.log('- Google AI: https://makersuite.google.com/app/apikey');
        console.log('- Supabase: https://supabase.com (optional)\n');
        
        console.log('📝 Edit your .env.local file and replace the placeholder values');
        console.log('   Then run: node setup-qdrant-cloud.js\n');
        
    } else {
        console.log('✅ .env.local appears to be properly configured');
        console.log('🧪 Testing configuration...\n');
        
        // Load environment variables
        require('dotenv').config({ path: envPath });
        
        // Test Qdrant configuration
        const qdrantUrl = process.env.QDRANT_URL;
        const qdrantKey = process.env.QDRANT_API_KEY;
        const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        
        console.log('📊 Configuration Status:');
        console.log(`   Qdrant URL: ${qdrantUrl ? '✅ Set' : '❌ Missing'}`);
        console.log(`   Qdrant API Key: ${qdrantKey ? '✅ Set' : '❌ Missing'}`);
        console.log(`   Google AI Key: ${googleKey ? '✅ Set' : '❌ Missing'}\n`);
        
        if (qdrantUrl && qdrantKey && googleKey) {
            console.log('🚀 Ready to test Qdrant connection!');
            console.log('   Run: node setup-qdrant-cloud.js');
        } else {
            console.log('❌ Missing required credentials');
            console.log('   Please update your .env.local file\n');
        }
    }
} else {
    console.log('📝 Creating new .env.local file...');
    
    const envTemplate = `# Qdrant Cloud Configuration (Required for RAG)
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your_qdrant_api_key_here
QDRANT_COLLECTION=documents

# Google AI API Key (Required)
GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_api_key_here

# Supabase Configuration (Optional - for memory persistence)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Table Names
SUPABASE_CHAT_TABLE=chat_logs
CHAT_MESSAGES_TABLE=chat_messages_chatbot

# Optional: Qdrant Configuration
SIMILARITY_THRESHOLD=0.7
MIN_SIMILARITY_SCORE=0.6
BULK_EMBED_BATCH=128

# Optional: System Configuration
PORT=3000
`;
    
    fs.writeFileSync(envPath, envTemplate);
    console.log('✅ Created .env.local file with template');
    console.log('💡 Please edit the file and replace placeholder values with your actual credentials\n');
    
    console.log('🔗 Get your credentials from:');
    console.log('- Qdrant Cloud: https://cloud.qdrant.io');
    console.log('- Google AI: https://makersuite.google.com/app/apikey');
    console.log('- Supabase: https://supabase.com (optional)\n');
}

console.log('📖 Next Steps:');
console.log('1. Update .env.local with your actual credentials');
console.log('2. Run: node setup-qdrant-cloud.js');
console.log('3. Run: node test-qdrant-connection.js');
console.log('4. Start the chatbot: npm run dev\n');
