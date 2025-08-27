/**
 * LINE Bot Webhook API - Vercel Serverless Function
 * 従業員→AI秘書→経営者 コミュニケーションシステム
 */

import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import OpenAI from 'openai'

// サービス初期化
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

// メッセージ優先度定義
type Priority = 'urgent' | 'high' | 'normal' | 'low'
type Category = 'report' | 'consultation' | 'proposal' | 'issue'

interface MessageAnalysis {
  priority: Priority
  category: Category
  summary: string
  requiredAction: string
  sentiment: 'positive' | 'neutral' | 'negative'
}

// AI分析関数
async function analyzeMessage(message: string, userInfo: Record<string, unknown>): Promise<MessageAnalysis> {
  try {
    const prompt = `以下の従業員からのメッセージを分析してください。

従業員情報:
- 名前: ${userInfo?.name || '不明'}
- 部署: ${userInfo?.department || '不明'}

メッセージ: ${message}

以下のJSON形式で回答してください:
{
  "priority": "urgent/high/normal/low",
  "category": "report/consultation/proposal/issue", 
  "summary": "経営者向けの3行以内の要約",
  "requiredAction": "必要なアクション（ない場合は空文字）",
  "sentiment": "positive/neutral/negative"
}`

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system", 
          content: "あなたは経営者の秘書として、従業員からのメッセージを分析・要約する専門家です。"
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    })

    return JSON.parse(response.choices[0].message.content || '{}')
    
  } catch (error) {
    console.error('AI分析エラー:', error)
    return {
      priority: 'normal' as Priority,
      category: 'report' as Category, 
      summary: message.substring(0, 100),
      requiredAction: '',
      sentiment: 'neutral'
    }
  }
}

// 緊急通知送信
async function sendUrgentNotification(userId: string, analysis: MessageAnalysis, userInfo: Record<string, unknown>) {
  try {
    // 経営者のLINE IDを取得（実際の実装では管理画面で設定）
    const executiveId = await redis.get(`executive:${userInfo?.tenantId || 'default'}`)
    
    if (executiveId) {
      const notification = `🚨 緊急報告があります

報告者: ${userInfo?.name || '不明'}（${userInfo?.department || '不明'}）

【要約】
${analysis.summary}

【必要な対応】
${analysis.requiredAction || 'なし'}

すぐにご確認ください。`

      // LINE API で通知送信（実際の実装）
      const lineResponse = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
          to: executiveId,
          messages: [{ type: 'text', text: notification }]
        })
      })
      
      console.log('緊急通知送信:', lineResponse.status)
    }
  } catch (error) {
    console.error('通知送信エラー:', error)
  }
}

// メインのWebhook処理
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // const signature = request.headers.get('x-line-signature') || ''
    
    // LINE署名検証（本番では必須）
    // const isValid = validateSignature(body, signature)
    // if (!isValid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    
    const events = body.events || []
    
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId
        const message = event.message.text
        
        // ユーザー情報取得
        const userInfo = await redis.get(`user:${userId}`) as Record<string, unknown> || { name: '不明', department: '不明' }
        
        // メッセージをRedisに保存
        const messageData = {
          id: Date.now().toString(),
          userId,
          message,
          timestamp: new Date().toISOString(),
          processed: false
        }
        
        await redis.lpush('messages', JSON.stringify(messageData))
        
        // AI分析
        const analysis = await analyzeMessage(message, userInfo as Record<string, unknown>)
        
        // 分析結果保存
        await redis.set(`analysis:${messageData.id}`, JSON.stringify(analysis), { ex: 86400 })
        
        // 優先度別処理
        if (analysis.priority === 'urgent') {
          await sendUrgentNotification(userId, analysis, userInfo)
        }
        
        // 返信メッセージを生成
        let replyMessage = ''
        
        // AIによる適切な返信を生成
        try {
          const replyPrompt = `あなたは有能なAI秘書です。従業員からの以下のメッセージに対して、適切で親切な返信を作成してください。

従業員: ${userInfo?.name || '社員'}（${userInfo?.department || '部署不明'}）
メッセージ: ${message}

分析結果:
- 優先度: ${analysis.priority}
- カテゴリ: ${analysis.category}
- 要約: ${analysis.summary}
- 必要なアクション: ${analysis.requiredAction}

返信のポイント:
1. 共感的で丁寧な対応
2. 次のステップの提案
3. ${analysis.priority === 'urgent' ? '緊急対応していることを伝える' : '適切なタイミングで対応することを伝える'}
4. 簡潔で分かりやすい（3-5文程度）

返信メッセージ:`

          const replyResponse = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content: "あなたは経営者の代わりに従業員とコミュニケーションを取る有能なAI秘書です。"
              },
              { role: "user", content: replyPrompt }
            ],
            max_tokens: 300,
            temperature: 0.7
          })
          
          replyMessage = replyResponse.choices[0].message.content || ''
          
          // 優先度に応じた追加メッセージ
          if (analysis.priority === 'urgent') {
            replyMessage += '\n\n🚨 この件は緊急案件として経営者に通知済みです。'
          } else if (analysis.priority === 'high') {
            replyMessage += '\n\n📌 重要案件として記録し、優先的に対応いたします。'
          }
          
        } catch (error) {
          console.error('Reply generation error:', error)
          // フォールバック返信
          replyMessage = `${userInfo?.name || ''}様、ご報告ありがとうございます。

「${analysis.summary}」について承知いたしました。

${analysis.requiredAction ? `${analysis.requiredAction}を進めさせていただきます。` : '適切に対応させていただきます。'}

${analysis.priority === 'urgent' ? '🚨 緊急案件として経営者に通知済みです。' : ''}
何か追加の情報がございましたら、お知らせください。`
        }
        
        // LINE返信
        await fetch('https://api.line.me/v2/bot/message/reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
          },
          body: JSON.stringify({
            replyToken: event.replyToken,
            messages: [{
              type: 'text',
              text: replyMessage
            }]
          })
        })
      }
    }
    
    return NextResponse.json({ status: 'ok' })
    
  } catch (error) {
    console.error('Webhook処理エラー:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}