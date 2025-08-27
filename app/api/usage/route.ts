/**
 * API使用量管理
 * プランごとの使用制限と使用量トラッキング
 */

import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// プラン定義
const PLANS = {
  free: {
    name: 'フリープラン',
    monthlyMessageLimit: 100,
    employeeLimit: 5,
    price: 0
  },
  basic: {
    name: 'ベーシックプラン',
    monthlyMessageLimit: 1000,
    employeeLimit: 20,
    price: 5000
  },
  premium: {
    name: 'プレミアムプラン',
    monthlyMessageLimit: 10000,
    employeeLimit: 100,
    price: 20000
  },
  enterprise: {
    name: 'エンタープライズプラン',
    monthlyMessageLimit: -1, // 無制限
    employeeLimit: -1, // 無制限
    price: 50000
  }
}

// 使用量記録
export async function recordUsage(tenantId: string, type: 'message' | 'api_call') {
  const monthKey = new Date().toISOString().slice(0, 7) // YYYY-MM
  const usageKey = `tenant:${tenantId}:usage:${monthKey}:${type}`
  
  await redis.incr(usageKey)
  
  // 月末で自動削除（翌々月まで保持）
  await redis.expire(usageKey, 86400 * 60) // 60日間
}

// 使用量チェック
export async function checkUsageLimit(tenantId: string): Promise<{
  allowed: boolean
  usage: number
  limit: number
  remaining: number
}> {
  // テナント情報取得
  const tenantInfo = await redis.get(`tenant:${tenantId}:info`) as Record<string, unknown> | null
  if (!tenantInfo) {
    return { allowed: false, usage: 0, limit: 0, remaining: 0 }
  }
  
  const plan = tenantInfo.plan || 'free'
  const planDetails = PLANS[plan as keyof typeof PLANS]
  const limit = planDetails.monthlyMessageLimit
  
  // 無制限プランの場合
  if (limit === -1) {
    return { allowed: true, usage: 0, limit: -1, remaining: -1 }
  }
  
  // 現在の使用量取得
  const monthKey = new Date().toISOString().slice(0, 7)
  const usageKey = `tenant:${tenantId}:usage:${monthKey}:message`
  const usage = (await redis.get(usageKey) as number) || 0
  
  const allowed = usage < limit
  const remaining = Math.max(0, limit - usage)
  
  return { allowed, usage, limit, remaining }
}

export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json()
    
    switch (action) {
      case 'get_usage': {
        const { tenantId } = data
        
        if (!tenantId) {
          return NextResponse.json({
            error: 'Tenant ID is required'
          }, { status: 400 })
        }
        
        // テナント情報取得
        const tenantInfo = await redis.get(`tenant:${tenantId}:info`) as Record<string, unknown> | null
        if (!tenantInfo) {
          return NextResponse.json({
            error: 'Tenant not found'
          }, { status: 404 })
        }
        
        const plan = tenantInfo.plan || 'free'
        const planDetails = PLANS[plan as keyof typeof PLANS]
        
        // 現在月の使用量取得
        const monthKey = new Date().toISOString().slice(0, 7)
        const messageUsage = (await redis.get(`tenant:${tenantId}:usage:${monthKey}:message`) as number) || 0
        const apiUsage = (await redis.get(`tenant:${tenantId}:usage:${monthKey}:api_call`) as number) || 0
        
        // 従業員数取得
        const employees = await redis.smembers(`tenant:${tenantId}:employees`) || []
        const executives = await redis.smembers(`tenant:${tenantId}:executives`) || []
        const totalUsers = employees.length + executives.length
        
        return NextResponse.json({
          plan: {
            current: plan,
            details: planDetails
          },
          usage: {
            messages: {
              used: messageUsage,
              limit: planDetails.monthlyMessageLimit,
              remaining: planDetails.monthlyMessageLimit === -1 ? -1 : Math.max(0, planDetails.monthlyMessageLimit - messageUsage),
              percentage: planDetails.monthlyMessageLimit === -1 ? 0 : (messageUsage / planDetails.monthlyMessageLimit) * 100
            },
            employees: {
              used: totalUsers,
              limit: planDetails.employeeLimit,
              remaining: planDetails.employeeLimit === -1 ? -1 : Math.max(0, planDetails.employeeLimit - totalUsers)
            },
            apiCalls: apiUsage
          },
          billing: {
            currentMonth: monthKey,
            nextBillingDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()
          }
        })
      }
      
      case 'upgrade_plan': {
        const { tenantId, newPlan } = data
        
        if (!tenantId || !newPlan) {
          return NextResponse.json({
            error: 'Missing required fields'
          }, { status: 400 })
        }
        
        if (!PLANS[newPlan as keyof typeof PLANS]) {
          return NextResponse.json({
            error: 'Invalid plan'
          }, { status: 400 })
        }
        
        // テナント情報更新
        const tenantInfo = await redis.get(`tenant:${tenantId}:info`) as Record<string, unknown> | null
        if (!tenantInfo) {
          return NextResponse.json({
            error: 'Tenant not found'
          }, { status: 404 })
        }
        
        tenantInfo.plan = newPlan
        tenantInfo.planUpdatedAt = new Date().toISOString()
        
        await redis.set(`tenant:${tenantId}:info`, tenantInfo)
        
        // アップグレード履歴記録
        await redis.lpush(`tenant:${tenantId}:plan_history`, JSON.stringify({
          from: tenantInfo.plan,
          to: newPlan,
          timestamp: new Date().toISOString()
        }))
        
        return NextResponse.json({
          message: 'Plan upgraded successfully',
          newPlan: PLANS[newPlan as keyof typeof PLANS]
        })
      }
      
      case 'usage_history': {
        const { tenantId, months = 3 } = data
        
        if (!tenantId) {
          return NextResponse.json({
            error: 'Tenant ID is required'
          }, { status: 400 })
        }
        
        const history = []
        const today = new Date()
        
        for (let i = 0; i < months; i++) {
          const date = new Date(today.getFullYear(), today.getMonth() - i, 1)
          const monthKey = date.toISOString().slice(0, 7)
          
          const messageUsage = (await redis.get(`tenant:${tenantId}:usage:${monthKey}:message`) as number) || 0
          const apiUsage = (await redis.get(`tenant:${tenantId}:usage:${monthKey}:api_call`) as number) || 0
          
          history.push({
            month: monthKey,
            messages: messageUsage,
            apiCalls: apiUsage
          })
        }
        
        return NextResponse.json({
          history: history.reverse()
        })
      }
      
      default:
        return NextResponse.json({
          error: 'Invalid action'
        }, { status: 400 })
    }
    
  } catch (error) {
    console.error('Usage API error:', error)
    return NextResponse.json({
      error: 'Usage tracking failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ready',
    plans: PLANS,
    actions: {
      get_usage: 'Get current usage statistics',
      upgrade_plan: 'Upgrade to a new plan',
      usage_history: 'Get historical usage data'
    }
  })
}