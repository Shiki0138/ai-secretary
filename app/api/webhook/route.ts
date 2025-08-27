/**
 * LINE Bot Webhook API v2 - 役割ベース対応版
 * 経営者・従業員を区別したAI秘書システム
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

// ユーザーロール定義
type UserRole = 'executive' | 'employee' | 'unknown'

// メッセージ分析結果
interface MessageAnalysis {
  priority: 'urgent' | 'high' | 'normal' | 'low'
  category: 'report' | 'consultation' | 'proposal' | 'issue' | 'request' | 'schedule'
  summary: string
  requiredAction: string
  sentiment: 'positive' | 'neutral' | 'negative'
  intent: string // 意図の詳細
}

// ユーザー情報取得（役割判定付き）
async function getUserRole(userId: string): Promise<{ role: UserRole; userInfo: Record<string, unknown> | null }> {
  try {
    // ユーザー情報取得
    const userInfo = await redis.get(`user:${userId}`)
    
    if (userInfo && typeof userInfo === 'object') {
      // 経営者リストを確認
      const executives = await redis.smembers('executives') || []
      if (executives.includes(userId)) {
        return { role: 'executive', userInfo }
      }
      
      // roleフィールドで判定
      if ('role' in userInfo) {
        if (userInfo.role === 'executive' || userInfo.role === '経営者' || userInfo.role === 'CEO' || userInfo.role === '社長') {
          return { role: 'executive', userInfo }
        }
      }
      
      return { role: 'employee', userInfo }
    }
    
    // 未登録ユーザー
    return { role: 'unknown', userInfo: null }
    
  } catch (error) {
    console.error('User role detection error:', error)
    return { role: 'unknown', userInfo: null }
  }
}

// 経営者向けAI分析
async function analyzeExecutiveMessage(message: string): Promise<MessageAnalysis> {
  try {
    const prompt = `あなたは優秀な秘書です。経営者からの以下の指示や相談を分析してください。

経営者からのメッセージ: ${message}

以下のJSON形式で分析結果を返してください:
{
  "priority": "urgent/high/normal/low（実行の緊急度）",
  "category": "request/schedule/consultation/proposal/report/issue",
  "summary": "何を依頼されたかの要約（20字以内）",
  "requiredAction": "秘書として必要なアクション",
  "sentiment": "positive/neutral/negative",
  "intent": "具体的な意図（例：会議設定、資料作成依頼、情報確認など）"
}`

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "あなたは経営者の個人秘書として、指示を的確に理解し実行する専門家です。"
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    })

    return JSON.parse(response.choices[0].message.content || '{}')
    
  } catch (error) {
    console.error('Executive message analysis error:', error)
    return {
      priority: 'normal',
      category: 'request',
      summary: message.substring(0, 20),
      requiredAction: '確認が必要です',
      sentiment: 'neutral',
      intent: '不明'
    }
  }
}

// 従業員向けAI分析（既存の分析関数を改良）
async function analyzeEmployeeMessage(message: string, userInfo: Record<string, unknown> | null): Promise<MessageAnalysis> {
  try {
    const prompt = `あなたは経営者の秘書として、従業員からの報告や相談を分析します。

従業員情報:
- 名前: ${userInfo?.name || '不明'}
- 部署: ${userInfo?.department || '不明'}

メッセージ: ${message}

以下のJSON形式で分析結果を返してください:
{
  "priority": "urgent/high/normal/low（経営者への報告優先度）",
  "category": "report/consultation/proposal/issue",
  "summary": "経営者への報告サマリ（30字以内）",
  "requiredAction": "経営者が取るべきアクション",
  "sentiment": "positive/neutral/negative",
  "intent": "報告の意図"
}`

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "あなたは従業員と経営者の間を取り持つ秘書として、情報を適切に整理・伝達する専門家です。"
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    })

    return JSON.parse(response.choices[0].message.content || '{}')
    
  } catch (error) {
    console.error('Employee message analysis error:', error)
    return {
      priority: 'normal',
      category: 'report',
      summary: message.substring(0, 30),
      requiredAction: '',
      sentiment: 'neutral',
      intent: '不明'
    }
  }
}

// 経営者への返信生成
async function generateExecutiveReply(message: string, analysis: MessageAnalysis): Promise<string> {
  try {
    const prompt = `あなたは経営者の有能な秘書です。経営者からの以下の指示に対して、適切で丁寧な返信を作成してください。

経営者からの指示: ${message}

分析結果:
- カテゴリ: ${analysis.category}
- 意図: ${analysis.intent}
- 必要なアクション: ${analysis.requiredAction}

返信のポイント:
1. 指示を正確に理解したことを示す
2. 実行予定のアクションを具体的に説明
3. 必要に応じて確認事項を質問
4. 丁寧かつ効率的な文体
5. 3-5文程度で簡潔に

返信メッセージ:`

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "あなたは経営者に仕える優秀な秘書です。常に先回りして行動し、効率的にサポートします。"
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 300,
      temperature: 0.7
    })
    
    return response.choices[0].message.content || '承知いたしました。対応いたします。'
    
  } catch (error) {
    console.error('Executive reply generation error:', error)
    return '承知いたしました。すぐに対応いたします。詳細について確認させていただいてもよろしいでしょうか。'
  }
}

// 従業員への返信生成
async function generateEmployeeReply(message: string, analysis: MessageAnalysis, userInfo: Record<string, unknown> | null): Promise<string> {
  try {
    const prompt = `あなたは経営者の秘書として、従業員からの報告に返信します。

従業員: ${userInfo?.name || ''}様（${userInfo?.department || '部署不明'}）
メッセージ: ${message}

分析結果:
- 優先度: ${analysis.priority}
- カテゴリ: ${analysis.category}
- 要約: ${analysis.summary}

返信のポイント:
1. 報告への感謝
2. 内容を理解したことの確認
3. 経営者への伝達について言及
4. ${analysis.priority === 'urgent' ? '緊急対応することを明記' : '適切なタイミングで対応することを説明'}
5. プロフェッショナルかつ親切な対応

返信メッセージ:`

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "あなたは経営者の代理として従業員とコミュニケーションを取る秘書です。"
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 300,
      temperature: 0.7
    })
    
    return response.choices[0].message.content || 'ご報告ありがとうございます。確実に経営者に伝達いたします。'
    
  } catch (error) {
    console.error('Employee reply generation error:', error)
    return `${userInfo?.name || ''}様、ご報告ありがとうございます。内容を確認し、経営者に適切に伝達いたします。`
  }
}

// 経営者への通知（従業員からの重要メッセージ）
async function notifyExecutive(employeeInfo: Record<string, unknown> | null, message: string, analysis: MessageAnalysis) {
  try {
    // すべての経営者を取得
    const executives = await redis.smembers('executives') || []
    
    for (const executiveId of executives) {
      const notification = `📋 従業員からの${analysis.priority === 'urgent' ? '緊急' : ''}報告

報告者: ${employeeInfo?.name || '不明'}（${employeeInfo?.department || '部署不明'}）

【要約】
${analysis.summary}

【詳細】
${message}

${analysis.requiredAction ? `【推奨アクション】\n${analysis.requiredAction}` : ''}

${analysis.priority === 'urgent' ? '⚡ 至急のご確認をお願いいたします。' : ''}`;

      // LINE通知送信（実装省略）
      console.log(`Executive notification to ${executiveId}:`, notification)
      
      // 通知履歴を保存
      await redis.lpush('executive_notifications', JSON.stringify({
        executiveId,
        employeeId: employeeInfo?.userId,
        message,
        analysis,
        timestamp: new Date().toISOString()
      }))
    }
    
  } catch (error) {
    console.error('Executive notification error:', error)
  }
}

// メインのWebhook処理
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // const signature = request.headers.get('x-line-signature') || ''
    
    const events = body.events || []
    
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId
        const message = event.message.text
        
        // ユーザーの役割を判定
        const { role, userInfo } = await getUserRole(userId)
        
        // 未登録ユーザーの処理
        if (role === 'unknown') {
          await handleUnknownUser(event, userId, message)
          continue
        }
        
        // 役割に応じた処理
        if (role === 'executive') {
          // 経営者からのメッセージ
          await handleExecutiveMessage(event, userId, message)
        } else {
          // 従業員からのメッセージ
          await handleEmployeeMessage(event, userId, message, userInfo)
        }
      }
    }
    
    return NextResponse.json({ status: 'ok' })
    
  } catch (error) {
    console.error('Webhook処理エラー:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// 経営者メッセージ処理
async function handleExecutiveMessage(event: Record<string, unknown>, userId: string, message: string) {
  // メッセージ保存
  const messageData = {
    id: Date.now().toString(),
    userId,
    userRole: 'executive',
    message,
    timestamp: new Date().toISOString(),
    processed: false
  }
  
  await redis.lpush('executive_messages', JSON.stringify(messageData))
  
  // AI分析
  const analysis = await analyzeExecutiveMessage(message)
  
  // 分析結果保存
  await redis.set(`analysis:${messageData.id}`, JSON.stringify(analysis), { ex: 86400 * 7 })
  
  // 返信生成
  let replyMessage = await generateExecutiveReply(message, analysis)
  
  // 特定のアクションに基づく追加処理
  if (analysis.category === 'schedule' && analysis.intent.includes('会議')) {
    replyMessage += '\n\n📅 カレンダーを確認し、空き時間をお知らせいたします。'
  }
  
  // LINE返信
  await sendLineReply(event.replyToken, replyMessage)
}

// 従業員メッセージ処理
async function handleEmployeeMessage(event: Record<string, unknown>, userId: string, message: string, userInfo: Record<string, unknown> | null) {
  // メッセージ保存
  const messageData = {
    id: Date.now().toString(),
    userId,
    userRole: 'employee',
    message,
    timestamp: new Date().toISOString(),
    processed: false
  }
  
  await redis.lpush('employee_messages', JSON.stringify(messageData))
  
  // AI分析
  const analysis = await analyzeEmployeeMessage(message, userInfo)
  
  // 分析結果保存
  await redis.set(`analysis:${messageData.id}`, JSON.stringify(analysis), { ex: 86400 })
  
  // 優先度に応じた処理
  if (analysis.priority === 'urgent' || analysis.priority === 'high') {
    await notifyExecutive(userInfo, message, analysis)
  }
  
  // 返信生成
  let replyMessage = await generateEmployeeReply(message, analysis, userInfo)
  
  // 優先度に応じた追加メッセージ
  if (analysis.priority === 'urgent') {
    replyMessage += '\n\n🚨 緊急案件として、経営者に即座に通知いたしました。'
  } else if (analysis.priority === 'high') {
    replyMessage += '\n\n📌 重要案件として優先的に処理いたします。'
  }
  
  // LINE返信
  await sendLineReply(event.replyToken, replyMessage)
}

// 未登録ユーザー処理
async function handleUnknownUser(event: Record<string, unknown>, userId: string, message: string) {
  const replyMessage = `はじめまして。AI秘書システムです。

ご利用を開始するには、以下の情報をお送りください：
1. お名前
2. 会社名・部署
3. 役職（経営者/従業員）

例：「山田太郎です。ABC商事の営業部で部長をしています。」

ご登録後、すぐにご利用いただけます。`

  await sendLineReply(event.replyToken, replyMessage)
  
  // 登録プロセスの開始を記録
  await redis.set(`registration:${userId}`, JSON.stringify({
    startTime: new Date().toISOString(),
    message
  }), { ex: 3600 }) // 1時間で期限切れ
}

// LINE返信送信
async function sendLineReply(replyToken: string, message: string) {
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        replyToken,
        messages: [{
          type: 'text',
          text: message
        }]
      })
    })
  } catch (error) {
    console.error('LINE reply error:', error)
  }
}