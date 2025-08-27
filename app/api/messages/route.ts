import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function GET(request: NextRequest) {
  try {
    // 最新のメッセージを取得（最大20件）
    const messageStrings = await redis.lrange('messages', 0, 19)
    
    const messages = []
    for (const msgStr of messageStrings) {
      try {
        const message = JSON.parse(msgStr as string)
        
        // 対応する分析データを取得
        const analysisData = await redis.get(`analysis:${message.id}`)
        let analysis = null
        
        if (analysisData && typeof analysisData === 'string') {
          try {
            analysis = JSON.parse(analysisData)
          } catch (e) {
            // 分析データの解析に失敗した場合はnull
          }
        }
        
        // ユーザー情報を取得
        const userInfo = await redis.get(`user:${message.userId}`)
        let user = null
        if (userInfo && typeof userInfo === 'string') {
          try {
            user = JSON.parse(userInfo)
          } catch (e) {
            // ユーザー情報の解析に失敗した場合はnull
          }
        }
        
        messages.push({
          id: message.id,
          userId: message.userId,
          userName: user?.name || '不明',
          department: user?.department || '不明',
          message: message.message,
          timestamp: message.timestamp,
          priority: analysis?.priority || 'normal',
          category: analysis?.category || 'report',
          summary: analysis?.summary || message.message.substring(0, 100),
          sentiment: analysis?.sentiment || 'neutral',
          processed: message.processed || false
        })
        
      } catch (e) {
        console.error('Message parsing error:', e)
        continue
      }
    }
    
    return NextResponse.json({
      messages: messages,
      total: messages.length
    })

  } catch (error) {
    console.error('Messages API error:', error)
    
    // エラー時はデモデータを返す
    return NextResponse.json({
      messages: [
        {
          id: "demo-1",
          userId: "demo-user-1",
          userName: "田中太郎",
          department: "営業部",
          message: "来月の売上目標について相談があります。現在の進捗では達成が厳しい状況です。",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          priority: "high",
          category: "consultation",
          summary: "来月の売上目標達成が困難、相談が必要",
          sentiment: "negative",
          processed: true
        },
        {
          id: "demo-2", 
          userId: "demo-user-2",
          userName: "佐藤花子",
          department: "開発部",
          message: "新機能の開発が完了しました。テストも順調で、来週リリース予定です。",
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          priority: "normal",
          category: "report",
          summary: "新機能開発完了、来週リリース予定",
          sentiment: "positive",
          processed: true
        }
      ],
      total: 2
    })
  }
}