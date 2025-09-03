import { getSupabaseClient } from '@/lib/supabase';
import { testQdrantConnection } from '@/lib/qdrant';

export async function GET() {
  const startTime = Date.now();
  
  try {
    const healthChecks = {
      supabase: { status: 'unknown', responseTime: 0 },
      qdrant: { status: 'unknown', responseTime: 0 },
    };

    // Test Supabase connection
    try {
      const supabaseStart = Date.now();
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.from('chat_logs').select('count').limit(1);
        healthChecks.supabase = {
          status: 'healthy',
          responseTime: Date.now() - supabaseStart,
        };
      } else {
        healthChecks.supabase = {
          status: 'unavailable',
          responseTime: 0,
        };
      }
    } catch (error) {
      healthChecks.supabase = {
        status: 'error',
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Test Qdrant connection
    try {
      const qdrantStart = Date.now();
      const qdrantResult = await testQdrantConnection();
      healthChecks.qdrant = {
        status: qdrantResult.success ? 'healthy' : 'error',
        responseTime: Date.now() - qdrantStart,
        error: qdrantResult.success ? undefined : qdrantResult.error,
      };
    } catch (error) {
      healthChecks.qdrant = {
        status: 'error',
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Determine overall health
    const overallStatus = Object.values(healthChecks).every(
      check => check.status === 'healthy'
    ) ? 'healthy' : 'degraded';

    const totalResponseTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        responseTime: totalResponseTime,
        services: healthChecks,
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      }),
      {
        status: overallStatus === 'healthy' ? 200 : 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Response-Time': `${totalResponseTime}ms`,
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }
}
