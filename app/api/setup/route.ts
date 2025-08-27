import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()
    
    if (action === 'setup_demo_data') {
      // デモユーザーデータを設定
      const demoUsers = [
        {
          userId: 'demo-user-001',
          name: '田中太郎',
          department: '営業部',
          role: '営業マネージャー',
          tenantId: 'demo-tenant-001'
        },
        {
          userId: 'demo-user-002', 
          name: '佐藤花子',
          department: '開発部',
          role: 'シニアエンジニア',
          tenantId: 'demo-tenant-001'
        },
        {
          userId: 'demo-user-003',
          name: '鈴木一郎',
          department: '人事部',
          role: 'HRマネージャー',
          tenantId: 'demo-tenant-001'
        }
      ]
      
      // ユーザー情報をRedisに保存
      for (const user of demoUsers) {
        await redis.set(`user:${user.userId}`, JSON.stringify(user))
      }
      
      // テナント情報を設定
      await redis.sadd('tenants', 'demo-tenant-001')
      await redis.set('tenant:demo-tenant-001', JSON.stringify({
        id: 'demo-tenant-001',
        name: 'デモ株式会社',
        plan: 'professional',
        created_at: new Date().toISOString(),
        is_active: true
      }))
      
      // 経営者のLINE IDを設定（デモ用）
      await redis.set('executive:demo-tenant-001', 'demo-executive-001')
      
      // サンプルメッセージを作成
      const sampleMessages = [
        {
          id: Date.now().toString(),
          userId: 'demo-user-001',
          message: '来月の売上目標について相談があります。現在の進捗では達成が厳しい状況で、追加の施策が必要かもしれません。',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          processed: true
        },
        {
          id: (Date.now() + 1).toString(),
          userId: 'demo-user-002',
          message: '新機能の開発が予定より早く完了しました。品質テストも順調で、来週のリリースに向けて準備中です。',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          processed: true
        },
        {
          id: (Date.now() + 2).toString(),
          userId: 'demo-user-003',
          message: '急ぎの件：明日の面接官が体調不良で欠席になりました。代替の面接官を至急手配する必要があります。',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          processed: true
        }
      ]
      
      // メッセージをRedisに保存
      for (const message of sampleMessages) {
        await redis.lpush('messages', JSON.stringify(message))
      }
      
      // 対応する分析データを作成
      const sampleAnalyses = [
        {
          id: sampleMessages[0].id,
          priority: 'high',
          category: 'consultation',
          summary: '売上目標達成困難、追加施策の検討が必要',
          requiredAction: '営業戦略の見直しと追加施策の検討',
          sentiment: 'negative'
        },
        {
          id: sampleMessages[1].id,
          priority: 'normal',
          category: 'report',
          summary: '新機能開発完了、予定より早いリリース準備',
          requiredAction: '',
          sentiment: 'positive'
        },
        {
          id: sampleMessages[2].id,
          priority: 'urgent',
          category: 'issue',
          summary: '明日の面接官欠席、代替面接官の緊急手配必要',
          requiredAction: '代替面接官の緊急手配',
          sentiment: 'neutral'
        }
      ]
      
      // 分析データをRedisに保存
      for (const analysis of sampleAnalyses) {
        await redis.set(`analysis:${analysis.id}`, JSON.stringify(analysis), { ex: 86400 })
      }
      
      return NextResponse.json({
        message: 'Demo data setup completed',
        users_created: demoUsers.length,
        messages_created: sampleMessages.length,
        analyses_created: sampleAnalyses.length
      })
    }
    
    if (action === 'clear_data') {
      // 全データをクリア
      const keys = await redis.keys('*')
      if (keys.length > 0) {
        await redis.del(...keys)
      }
      
      return NextResponse.json({
        message: 'All data cleared',
        keys_deleted: keys.length
      })
    }
    
    return NextResponse.json({
      error: 'Invalid action'
    }, { status: 400 })
    
  } catch (error) {
    console.error('Setup API error:', error)
    return NextResponse.json({
      error: 'Setup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // 現在のデータ状況を確認
    const messageCount = await redis.llen('messages') || 0
    const userKeys = await redis.keys('user:*')
    const analysisKeys = await redis.keys('analysis:*')
    const tenantCount = await redis.scard('tenants') || 0
    
    return NextResponse.json({
      status: 'ready',
      data_overview: {
        messages: messageCount,
        users: userKeys.length,
        analyses: analysisKeys.length,
        tenants: tenantCount
      },
      actions: {
        setup_demo_data: 'POST /api/setup with action: setup_demo_data',
        clear_data: 'POST /api/setup with action: clear_data'
      }
    })
    
  } catch (error) {
    console.error('Setup check error:', error)
    return NextResponse.json({
      error: 'Setup check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}