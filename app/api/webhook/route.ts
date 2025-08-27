/**
 * LINE Bot Webhook API - マルチテナント対応版
 * 企業ごとに完全にデータを分離
 */

import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import OpenAI from 'openai'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

// 型定義
interface UserInfo {
  userId: string
  name: string
  tenantId: string
  role: 'executive' | 'employee'
  department?: string
  registeredAt: string
}

interface MessageAnalysis {
  priority: 'urgent' | 'high' | 'normal' | 'low'
  category: 'report' | 'consultation' | 'proposal' | 'issue'
  summary: string
  requiredAction: string
  sentiment: 'positive' | 'neutral' | 'negative'
}

// ユーザー情報取得（テナント情報付き）
async function getUserWithTenant(userId: string): Promise<{ userInfo: UserInfo | null; tenantId: string | null }> {
  try {
    // グローバルユーザー情報からテナントID取得
    const globalUser = await redis.get(`user:${userId}`) as { tenantId: string; role: string } | null
    
    if (!globalUser || !globalUser.tenantId) {
      return { userInfo: null, tenantId: null }
    }
    
    // テナント固有のユーザー情報取得
    const userInfo = await redis.get(`tenant:${globalUser.tenantId}:user:${userId}`) as UserInfo | null
    
    return { userInfo, tenantId: globalUser.tenantId }
    
  } catch (error) {
    console.error('User fetch error:', error)
    return { userInfo: null, tenantId: null }
  }
}

// AI分析（テナントコンテキスト付き）
async function analyzeMessage(message: string, userInfo: UserInfo | null, tenantInfo: Record<string, unknown> | null): Promise<MessageAnalysis> {
  try {
    const prompt = `あなたは${tenantInfo?.companyName || '企業'}の秘書として、従業員からのメッセージを分析します。

従業員情報:
- 名前: ${userInfo?.name || '不明'}
- 部署: ${userInfo?.department || '不明'}

メッセージ: ${message}

以下のJSON形式で分析してください:
{
  "priority": "urgent/high/normal/low",
  "category": "report/consultation/proposal/issue",
  "summary": "経営者向け要約（30字以内）",
  "requiredAction": "必要なアクション",
  "sentiment": "positive/neutral/negative"
}`

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "あなたは企業の有能な秘書です。"
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    })

    return JSON.parse(response.choices[0].message.content || '{}')
    
  } catch {
    return {
      priority: 'normal',
      category: 'report',
      summary: message.substring(0, 30),
      requiredAction: '',
      sentiment: 'neutral'
    }
  }
}

// 経営者メッセージ処理（テナント対応）
async function handleExecutiveMessage(
  event: Record<string, unknown>,
  userId: string,
  message: string,
  userInfo: UserInfo,
  tenantId: string
) {
  // メッセージをテナント固有のキューに保存
  const messageData = {
    id: Date.now().toString(),
    userId,
    message,
    timestamp: new Date().toISOString(),
    userRole: 'executive'
  }
  
  await redis.lpush(`tenant:${tenantId}:executive_messages`, JSON.stringify(messageData))
  
  // 返信生成
  const replyMessage = await generateExecutiveReply(message, userInfo)
  const replyToken = event['replyToken'] as string
  await sendLineReply(replyToken, replyMessage)
}

// 従業員メッセージ処理（テナント対応）
async function handleEmployeeMessage(
  event: Record<string, unknown>,
  userId: string,
  message: string,
  userInfo: UserInfo,
  tenantId: string
) {
  // テナント情報取得
  const tenantInfo = await redis.get(`tenant:${tenantId}:info`) as Record<string, unknown> | null
  
  // メッセージをテナント固有のキューに保存
  const messageData = {
    id: Date.now().toString(),
    userId,
    userInfo,
    message,
    timestamp: new Date().toISOString()
  }
  
  await redis.lpush(`tenant:${tenantId}:employee_messages`, JSON.stringify(messageData))
  
  // AI分析
  const analysis = await analyzeMessage(message, userInfo, tenantInfo)
  
  // 分析結果をテナント固有のキーで保存
  await redis.set(`tenant:${tenantId}:analysis:${messageData.id}`, JSON.stringify(analysis), { ex: 86400 * 7 })
  
  // 同じテナントの経営者に通知
  if (analysis.priority === 'urgent' || analysis.priority === 'high') {
    await notifyTenantExecutives(tenantId, userInfo, message, analysis)
  }
  
  // 返信生成
  const replyMessage = await generateEmployeeReply(message, analysis, userInfo)
  const replyToken = event['replyToken'] as string
  await sendLineReply(replyToken, replyMessage)
}

// テナント内の経営者への通知
async function notifyTenantExecutives(
  tenantId: string,
  employeeInfo: UserInfo,
  message: string,
  analysis: MessageAnalysis
) {
  // 同じテナントの経営者のみ取得
  const executiveIds = await redis.smembers(`tenant:${tenantId}:executives`) || []
  
  const notification = `📋 ${analysis.priority === 'urgent' ? '緊急' : '重要'}報告

報告者: ${employeeInfo.name}（${employeeInfo.department || '部署不明'}）

【要約】
${analysis.summary}

【詳細】
${message}

${analysis.requiredAction ? `【推奨アクション】\n${analysis.requiredAction}` : ''}`

  // 各経営者に通知
  for (const execId of executiveIds) {
    await sendLineNotification(execId, notification)
  }
}

// 未登録ユーザー処理（テナント招待コード対応）
async function handleUnknownUser(event: Record<string, unknown>, userId: string, message: string) {
  // 招待コードチェック
  const inviteMatch = message.match(/招待コード[:：]?\s*([A-Z0-9]{6,})/i)
  
  if (inviteMatch) {
    const inviteCode = inviteMatch[1]
    const inviteInfo = await redis.get(`invite:${inviteCode}`)
    
    if (inviteInfo && typeof inviteInfo === 'object') {
      const { tenantId, role } = inviteInfo as { tenantId: string; role: string }
      
      const replyToken = event['replyToken'] as string
      await sendLineReply(
        replyToken,
        `招待コードが確認できました。
        
続けて以下の情報をお送りください：
1. お名前
2. 部署（任意）

例：「山田太郎です。営業部です。」`
      )
      
      // 招待プロセスを記録
      await redis.set(`registration:${userId}`, JSON.stringify({
        tenantId,
        role,
        inviteCode,
        timestamp: new Date().toISOString()
      }), { ex: 3600 })
      
      return
    }
  }
  
  // 自動登録パターンチェック（新規テナント作成）
  const patterns = [
    /(.+)です。.*合同会社\s*([^\s]+).*の.*経営者/,
    /(.+)です。.*会社\s*([^\s]+).*の.*経営者/,
    /(.+)です。.*([^\s]+).*の.*経営者/,
    /(.+)です。.*([^\s]+).*CEO/,
    /(.+)です。.*([^\s]+).*社長/
  ]
  
  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match) {
      const name = match[1].trim()
      const companyName = match[2] ? match[2].trim() : '未設定'
      
      // 新規テナント作成
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-secretary-ten.vercel.app'}/api/tenant-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_tenant',
          data: {
            companyName,
            adminUserId: userId,
            adminName: name
          }
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        
        const replyToken = event['replyToken'] as string
        await sendLineReply(
          replyToken,
          `${name}様、はじめまして。

AI秘書システムへようこそ。
${companyName}の経営者として登録完了しました。

テナントID: ${result.tenantId}

従業員を招待する場合は、以下の招待コードをお伝えください：
招待コード: ${result.tenantId.slice(-8).toUpperCase()}

どのようなご用件でしょうか？`
        )
        return
      }
    }
  }
  
  // 通常の登録案内
  const replyToken = event['replyToken'] as string
  await sendLineReply(
    replyToken,
    `はじめまして。AI秘書システムです。

【新規登録の場合】
以下の形式でお送りください：
「山田太郎です。ABC商事の経営者をしています。」

【既存企業に参加の場合】
招待コードをお持ちの方は：
「招待コード: XXXXXX」

どちらかの方法でご登録ください。`
  )
}

// 返信生成関数
async function generateExecutiveReply(message: string, userInfo: UserInfo): Promise<string> {
  const prompt = `あなたは${userInfo.name}様の有能な秘書です。以下の指示に適切に応答してください。

指示: ${message}

簡潔で的確な返信を作成してください。`

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "あなたは有能な秘書です。" },
        { role: "user", content: prompt }
      ],
      max_tokens: 200
    })
    
    return response.choices[0].message.content || '承知いたしました。'
  } catch {
    return '承知いたしました。対応いたします。'
  }
}

async function generateEmployeeReply(
  message: string,
  analysis: MessageAnalysis,
  userInfo: UserInfo
): Promise<string> {
  let reply = `${userInfo.name}様、ご報告ありがとうございます。

「${analysis.summary}」について承りました。`

  if (analysis.priority === 'urgent') {
    reply += '\n\n🚨 緊急案件として経営者に即座に通知いたしました。'
  } else if (analysis.priority === 'high') {
    reply += '\n\n📌 重要案件として優先的に処理いたします。'
  } else {
    reply += '\n\n適切なタイミングで経営者に報告いたします。'
  }
  
  return reply
}

// LINE通知送信
async function sendLineNotification(userId: string, message: string) {
  try {
    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: 'text', text: message }]
      })
    })
  } catch (error) {
    console.error('LINE notification error:', error)
  }
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

// メインのWebhook処理
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const events = body.events || []
    
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId
        const message = event.message.text
        
        // ユーザーとテナント情報取得
        const { userInfo, tenantId } = await getUserWithTenant(userId)
        
        if (!userInfo || !tenantId) {
          await handleUnknownUser(event, userId, message)
          continue
        }
        
        // 役割に応じた処理
        if (userInfo.role === 'executive') {
          await handleExecutiveMessage(event, userId, message, userInfo, tenantId)
        } else {
          await handleEmployeeMessage(event, userId, message, userInfo, tenantId)
        }
      }
    }
    
    return NextResponse.json({ status: 'ok' })
    
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}