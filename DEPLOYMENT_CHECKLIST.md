# Deployment Checklist

Use this checklist to ensure your chatbot is production-ready before deploying to Vercel.

## Pre-Deployment Checklist

### Environment Setup
- [ ] All environment variables are configured in Vercel dashboard
- [ ] Production API keys have proper permissions and quotas
- [ ] Database connections are tested and working
- [ ] External services (Qdrant, Supabase) are accessible from Vercel

### Code Quality
- [ ] All TypeScript errors are resolved (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds locally (`npm run build`)
- [ ] Tests pass (if applicable)

### Security
- [ ] Environment variables are marked as "Secret" in Vercel
- [ ] API keys have appropriate restrictions
- [ ] CORS settings are configured for production
- [ ] Rate limiting is implemented (optional but recommended)

## Deployment Steps

### 1. Vercel Setup
- [ ] Create Vercel account and install CLI
- [ ] Connect your Git repository
- [ ] Configure build settings
- [ ] Set environment variables

### 2. Domain Configuration
- [ ] Custom domain is configured (if applicable)
- [ ] DNS records are properly set
- [ ] SSL certificate is valid

### 3. External Services
- [ ] Qdrant Cloud instance is running
- [ ] Supabase project is configured
- [ ] Google AI API quotas are set

## Post-Deployment Verification

### Health Checks
- [ ] Health endpoint responds correctly (`/health`)
- [ ] All services show as "healthy"
- [ ] Response times are acceptable

### Functionality Testing
- [ ] Chat interface loads correctly
- [ ] Messages are sent and received
- [ ] Vector search is working
- [ ] Database logging is functional

### Performance
- [ ] Page load times are acceptable
- [ ] API response times are reasonable
- [ ] No console errors in browser

## Monitoring Setup

### Vercel Analytics
- [ ] Web Analytics is enabled
- [ ] Core Web Vitals are being tracked
- [ ] Performance metrics are visible

### Error Tracking
- [ ] Sentry is configured (if using)
- [ ] Error logs are being captured
- [ ] Alerts are set up for critical errors

## Maintenance Tasks

### Regular Checks
- [ ] Monitor API usage and costs
- [ ] Check database performance
- [ ] Review error logs
- [ ] Update dependencies

### Backup Strategy
- [ ] Database backups are configured
- [ ] Environment variables are documented
- [ ] Rollback plan is in place

## Emergency Procedures

### Rollback
- [ ] Previous deployment is accessible
- [ ] Database rollback procedure is documented
- [ ] Environment variable rollback is planned

### Support Contacts
- [ ] Vercel support access
- [ ] External service support contacts
- [ ] Team escalation procedures

## Final Verification

Before going live, ensure:
- [ ] All checklist items are completed
- [ ] Team has been notified of deployment
- [ ] Monitoring is active and alerting
- [ ] Support team is ready for potential issues

---

**Remember**: Production deployments should be done during low-traffic periods, and always have a rollback plan ready.
