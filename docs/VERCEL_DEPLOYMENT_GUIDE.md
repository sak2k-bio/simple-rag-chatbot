# Vercel Deployment Guide for Simple Chatbot

This guide provides a step-by-step walkthrough for deploying your Next.js chatbot application on Vercel and making it production-ready.

-npm install -g vercel

-Deploy using the script:
   chmod +x deploy-to-vercel.sh
   ./deploy-to-vercel.sh

-or manually =    vercel --prod

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Project Preparation](#project-preparation)
3. [Environment Configuration](#environment-configuration)
4. [Vercel Deployment](#vercel-deployment)
5. [Production Optimizations](#production-optimizations)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying, ensure you have:
- [Node.js 18+](https://nodejs.org/) installed locally
- [Git](https://git-scm.com/) installed and configured
- A [Vercel account](https://vercel.com/signup)
- [Vercel CLI](https://vercel.com/docs/cli) installed (optional but recommended)
- Your project code committed to a Git repository (GitHub, GitLab, or Bitbucket)

## Project Preparation

### 1. Update Next.js Configuration

Your `next.config.ts` is minimal, which is good for production. However, let's add some production optimizations:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static optimization
  output: 'standalone',
  
  // Optimize images
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  
  // Environment variables validation
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
};

export default nextConfig;
```

### 2. Add Build Scripts

Update your `package.json` scripts for better production builds:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "type-check": "tsc --noEmit",
    "build:analyze": "ANALYZE=true next build"
  }
}
```

### 3. Create Production Environment File

Create a `.env.production` file (don't commit this to Git):

```bash
# Google AI
GOOGLE_API_KEY=your_production_google_api_key

# Qdrant Vector Database
QDRANT_URL=https://your-qdrant-instance.cloud
QDRANT_API_KEY=your_production_qdrant_api_key
QDRANT_COLLECTION=documents

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
SUPABASE_CHAT_TABLE=chat_logs
CHAT_MESSAGES_TABLE=chat_messages_chatbot

# Production-specific settings
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

### 4. Add Environment Validation

Create a new file `src/lib/env.ts` to validate environment variables:

```typescript
import { z } from 'zod';

const envSchema = z.object({
  GOOGLE_API_KEY: z.string().min(1, 'Google API key is required'),
  QDRANT_URL: z.string().url('QDRANT_URL must be a valid URL'),
  QDRANT_API_KEY: z.string().min(1, 'QDRANT API key is required'),
  QDRANT_COLLECTION: z.string().min(1, 'QDRANT collection name is required'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Supabase URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required'),
  SUPABASE_CHAT_TABLE: z.string().default('chat_logs'),
  CHAT_MESSAGES_TABLE: z.string().default('chat_messages_chatbot'),
});

export const env = envSchema.parse(process.env);
```

## Environment Configuration

### 1. Google AI API Setup

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Set appropriate quotas and restrictions
4. Add the key to your environment variables

### 2. Qdrant Cloud Setup

1. Follow the [QDRANT_CLOUD_SETUP.md](./QDRANT_CLOUD_SETUP.md) guide
2. Ensure your Qdrant instance is accessible from Vercel's servers
3. Set up proper authentication and collection structure

### 3. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Set up the required tables using the provided SQL scripts
3. Configure Row Level Security (RLS) policies
4. Get your API keys from Project Settings > API

## Vercel Deployment

### Method 1: Vercel Dashboard (Recommended for first deployment)

1. **Connect Repository**
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your Git repository
   - Select the repository containing your chatbot

2. **Configure Project**
   - Project Name: `your-chatbot-name`
   - Framework Preset: `Next.js`
   - Root Directory: `./` (or your project root)
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

3. **Environment Variables**
   - Add all environment variables from your `.env.production` file
   - Ensure sensitive keys are marked as "Secret"
   - Set `NODE_ENV=production`

4. **Deploy**
   - Click "Deploy"
   - Wait for the build to complete
   - Your app will be available at `https://your-project.vercel.app`

### Method 2: Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy from project directory**
   ```bash
   cd your-project-directory
   vercel --prod
   ```

4. **Follow the prompts to configure your project**

### 3. Custom Domain (Optional)

1. Go to your project settings in Vercel
2. Navigate to "Domains"
3. Add your custom domain
4. Configure DNS records as instructed

## Production Optimizations

### 1. Performance Optimizations

**Enable Edge Runtime for API Routes**

Update your API routes to use Edge Runtime for better performance:

```typescript
// src/app/api/chat/route.ts
export const runtime = 'edge';

export async function POST(request: Request) {
  // Your existing code
}
```

**Add Caching Headers**

```typescript
// In your API routes
export async function GET() {
  return new Response(data, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
```

### 2. Security Enhancements

**Add Rate Limiting**

Install `@upstash/ratelimit` and `@upstash/redis`:

```bash
npm install @upstash/ratelimit @upstash/redis
```

Create `src/lib/rate-limit.ts`:

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
});

export async function checkRateLimit(identifier: string) {
  const { success, limit, reset, remaining } = await ratelimit.limit(identifier);
  
  if (!success) {
    throw new Error(`Rate limit exceeded. Try again in ${Math.ceil((reset - Date.now()) / 1000)} seconds.`);
  }
  
  return { success, limit, reset, remaining };
}
```

**Add CORS Protection**

```typescript
// In your API routes
export async function POST(request: Request) {
  // Check origin
  const origin = request.headers.get('origin');
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  
  if (origin && !allowedOrigins.includes(origin)) {
    return new Response('Forbidden', { status: 403 });
  }
  
  // Your existing code
}
```

### 3. Error Handling & Logging

**Enhanced Error Handling**

Update your API routes with better error handling:

```typescript
export async function POST(request: Request) {
  try {
    // Your existing code
  } catch (error) {
    console.error('Chat API error:', error);
    
    // Don't expose internal errors to clients
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
```

**Add Application Monitoring**

Install Sentry for error tracking:

```bash
npm install @sentry/nextjs
```

Create `sentry.client.config.ts`:

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
});
```

### 4. Database Optimizations

**Connection Pooling**

Update your Supabase client for better connection management:

```typescript
// src/lib/supabase.ts
export function getSupabaseClient(): SupabaseClient | null {
  // ... existing code ...
  
  try {
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          'X-Client-Info': 'simple-chatbot@1.0.0',
        },
      },
      // Add connection pooling for production
      db: {
        schema: 'public',
      },
    });
    
    return supabaseClient;
  } catch (error) {
    console.error('Failed to create Supabase client:', error);
    return null;
  }
}
```

## Monitoring & Maintenance

### 1. Vercel Analytics

Enable Vercel Analytics in your project dashboard:
- Go to Project Settings > Analytics
- Enable Web Analytics
- Monitor Core Web Vitals and performance metrics

### 2. Health Checks

Create a health check endpoint:

```typescript
// src/app/api/health/route.ts
export async function GET() {
  try {
    // Test database connections
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('chat_logs').select('count').limit(1);
    }
    
    // Test Qdrant connection
    await testQdrantConnection();
    
    return new Response(
      JSON.stringify({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          supabase: 'connected',
          qdrant: 'connected'
        }
      }), 
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      }), 
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
```

### 3. Automated Deployments

Set up GitHub Actions for automated deployments:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run build
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

## Troubleshooting

### Common Issues

1. **Environment Variables Not Loading**
   - Ensure all variables are set in Vercel dashboard
   - Check variable names match exactly
   - Restart deployment after adding variables

2. **Build Failures**
   - Check Node.js version compatibility
   - Verify all dependencies are in `package.json`
   - Check for TypeScript errors with `npm run type-check`

3. **API Errors in Production**
   - Verify external service credentials
   - Check CORS settings
   - Monitor Vercel function logs

4. **Performance Issues**
   - Enable Edge Runtime for API routes
   - Implement proper caching strategies
   - Monitor Core Web Vitals

### Debug Commands

```bash
# Local build test
npm run build

# Type checking
npm run type-check

# Linting
npm run lint

# Test production build locally
npm run build && npm run start
```

### Support Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Vercel Community](https://github.com/vercel/vercel/discussions)

## Final Checklist

Before going live, ensure:

- [ ] All environment variables are set in Vercel
- [ ] Database connections are working
- [ ] API keys have proper production permissions
- [ ] Error handling is implemented
- [ ] Rate limiting is configured
- [ ] Health check endpoint is working
- [ ] Custom domain is configured (if applicable)
- [ ] SSL certificate is valid
- [ ] Monitoring is set up
- [ ] Backup strategy is in place

## Conclusion

Your chatbot is now deployed and production-ready! Monitor the application using Vercel's built-in tools and set up additional monitoring as needed. Remember to regularly update dependencies and monitor performance metrics to ensure optimal user experience.

For ongoing maintenance, consider:
- Setting up automated dependency updates
- Implementing feature flags for safe deployments
- Creating a rollback strategy
- Setting up alerting for critical errors
- Regular security audits of dependencies
