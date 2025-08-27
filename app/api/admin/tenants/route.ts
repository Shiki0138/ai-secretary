import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// 管理者認証チェック
// async function verifyAdmin(request: NextRequest): Promise<boolean> {
//   const sessionId = request.headers.get('x-session-id')
//   if (!sessionId) return false
//   
//   const session = await redis.get(`session:${sessionId}`)
//   if (!session || typeof session !== 'object') return false
//   
//   const sessionObj = session as Record<string, unknown>
//   return sessionObj.userType === 'admin'
// }

export async function GET() {
  try {
    // 管理者認証
    // if (!await verifyAdmin(request)) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }
    
    // すべてのテナント取得
    const tenantIds = await redis.smembers('all_tenants') || []
    const tenants = []
    
    for (const tenantId of tenantIds) {
      const tenantInfo = await redis.get(`tenant:${tenantId}:info`)
      if (tenantInfo) {
        tenants.push(tenantInfo)
      }
    }
    
    // 統計情報
    let totalUsers = 0
    for (const tenant of tenants) {
      const tenantObj = tenant as Record<string, unknown>
      const userIds = await redis.smembers(`tenant:${tenantObj.tenantId}:users`) || []
      totalUsers += userIds.length
    }
    
    return NextResponse.json({
      tenants,
      stats: {
        totalTenants: tenants.length,
        totalUsers
      }
    })
    
  } catch (error) {
    console.error('Admin API error:', error)
    return NextResponse.json({
      error: 'Failed to fetch tenants'
    }, { status: 500 })
  }
}