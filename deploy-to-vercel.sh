#!/bin/bash

# Quick Deploy to Vercel Script
# This script helps you deploy your chatbot to Vercel quickly

set -e

echo "🚀 Starting Vercel deployment..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Check if user is logged in
if ! vercel whoami &> /dev/null; then
    echo "🔐 Please log in to Vercel..."
    vercel login
fi

# Check if project exists
if [ -f ".vercel/project.json" ]; then
    echo "📁 Existing Vercel project found. Deploying..."
    vercel --prod
else
    echo "🆕 Setting up new Vercel project..."
    vercel --prod
fi

echo "✅ Deployment completed!"
echo "🌐 Your app should be available at the URL shown above"
echo ""
echo "📋 Next steps:"
echo "1. Set up environment variables in Vercel dashboard"
echo "2. Configure your custom domain (if applicable)"
echo "3. Test the health endpoint: /health"
echo "4. Monitor the deployment in Vercel dashboard"
echo ""
echo "📚 For detailed instructions, see: docs/VERCEL_DEPLOYMENT_GUIDE.md"
